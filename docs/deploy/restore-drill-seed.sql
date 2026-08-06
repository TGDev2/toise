-- Jeu de données du drill de restauration (docs/deploy/restore-drill.sh).
--
-- Volontairement minimal en volume et complet en *nature* : chaque famille de
-- données que la restauration doit rendre intacte est représentée une fois.
-- Un jeu plus gros n'apporterait rien — ce qui casse une restauration, ce
-- n'est pas le nombre de lignes, c'est un type de donnée oublié (jsonb, date,
-- numeric, tableau, compteur hors entité TypeORM).
--
-- UUID fixes : les assertions du drill les citent en clair, et une empreinte
-- reproductible d'une exécution à l'autre rend un échec lisible.

BEGIN;

-- Extension ------------------------------------------------------------------
-- `uuid-ossp` est présente dans la base réelle alors qu'**aucune migration du
-- dépôt ne la crée** (vérifié : zéro `CREATE EXTENSION` dans `apps/api`). Elle
-- y a été posée à la main, et plus rien ne l'utilise — le schéma s'appuie
-- partout sur `gen_random_uuid()`, natif depuis Postgres 13.
--
-- Elle est reproduite ici pour une raison précise : sans elle, le drill
-- vérifierait la restauration des extensions sur une base qui n'en a qu'une,
-- `plpgsql`, présente d'office dans tout template. Le contrôle serait vide de
-- sens. Avec elle, la chaîne dump → GPG → `pg_restore` transporte réellement
-- une extension, et l'assertion mord.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Compte artisan ------------------------------------------------------------
INSERT INTO users (id, email, auth_provider, subscription_tier, email_verified,
                   firebase_uid, role)
VALUES ('c0000000-0000-4000-8000-000000000001', 'artisan@drill.chiffreo.test',
        'email', 'contractor_standard', true, 'drill-firebase-uid-1', 'user');

INSERT INTO organizations (id, name, owner_user_id, is_personal)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Drill Rénovation',
        'c0000000-0000-4000-8000-000000000001', false);

UPDATE users SET active_organization_id = 'a0000000-0000-4000-8000-000000000001'
WHERE id = 'c0000000-0000-4000-8000-000000000001';

INSERT INTO organization_memberships (organization_id, user_id, role)
VALUES ('a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001', 'owner');

-- Identité de facturation (obligatoire pour émettre une facture) -------------
INSERT INTO company_profiles (organization_id, user_id, raison_sociale, siret,
                              address_line1, postal_code, city, specialties,
                              legal_form, vat_number, iban, bic,
                              default_payment_terms_days, late_penalty_rate,
                              default_labor_hourly_rate)
VALUES ('a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'Drill Rénovation SARL', '12345678900012',
        '12 rue des Éprouvettes', '75011', 'Paris',
        ARRAY['peinture', 'revêtement de sol'],
        'SARL', 'FR12345678900', 'FR7630006000011234567890189', 'AGRIFRPP',
        30, 10.50, 45.00);

INSERT INTO clients (id, organization_id, user_id, name, email, phone,
                     address_line1, postal_code, city, is_company, siret)
VALUES ('c1000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'Madame Aurélie Dupré', 'client@drill.chiffreo.test', '+33612345678',
        '3 impasse du Béton', '75012', 'Paris', false, NULL);

-- Deux projets : un chiffré de bout en bout, un avec les photos --------------
INSERT INTO projects (id, organization_id, user_id, name, room_name, work_type, status)
VALUES ('a0000000-0000-4000-8000-000000000010',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'Appartement Dupré — séjour', 'Séjour', 'peinture', 'estimated'),
       ('a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'Appartement Dupré — salle de bain', 'Salle de bain', 'carrelage', 'draft');

INSERT INTO rooms (id, project_id, name, sort_order)
VALUES ('40000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000010', 'Séjour', 0);

INSERT INTO room_dimensions (room_id, length_cm, width_cm, height_cm,
                             confidence_score, source, segments_json, exclusions_json)
VALUES ('40000000-0000-4000-8000-000000000001', 520, 380, 250, 'high', 'manual',
        '[{"label": "mur nord", "length_cm": 520}]'::jsonb,
        '[{"label": "baie vitrée", "area_m2": 2.4}]'::jsonb);

-- Photos : les lignes doivent correspondre exactement aux fichiers que
-- restore-drill.sh écrit sur le volume `uploads`.
INSERT INTO project_photos (project_id, storage_url, thumbnail_url,
                            original_filename, mime_type, size_bytes, status, sort_order)
VALUES ('a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000002/b1000000-0000-4000-8000-000000000001.jpg',
        'a0000000-0000-4000-8000-000000000002/thumb_b1000000-0000-4000-8000-000000000001.jpg',
        'IMG_2031.jpg', 'image/jpeg', 184320, 'ready', 0),
       ('a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000002/b1000000-0000-4000-8000-000000000002.jpg',
        NULL, 'IMG_2032.jpg', 'image/jpeg', 2097152, 'ready', 1),
       ('a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000002/salle de bain - été.jpg',
        NULL, 'salle de bain - été.jpg', 'image/jpeg', 65536, 'ready', 2);

-- Estimation et liste d'achats ----------------------------------------------
INSERT INTO estimation_results (id, project_id, skill_level, items_json,
                                total_items, aggregated_json)
VALUES ('e0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000010', 'intermediate',
        '[{"material_name": "Peinture acrylique mate", "units_needed": 2,
           "packaging_label": "Pot 5 L", "unit_price": 42.90},
          {"material_name": "Sous-couche universelle", "units_needed": 1,
           "packaging_label": "Pot 2,5 L", "unit_price": 24.50}]'::jsonb,
        2,
        '{"total_surface_m2": 45.0, "total_cost_estimate": 110.30}'::jsonb);

INSERT INTO shopping_lists (project_id, estimation_id, items_json,
                            budget_summary_json, purchased_on)
VALUES ('a0000000-0000-4000-8000-000000000010',
        'e0000000-0000-4000-8000-000000000001',
        '[{"material_name": "Peinture acrylique mate", "units_needed": 2,
           "original_units_needed": 2, "unit_price": 42.90, "checked": true},
          {"material_name": "Sous-couche universelle", "units_needed": 1,
           "original_units_needed": 1, "unit_price": 24.50, "checked": false}]'::jsonb,
        '{"total_ttc": 110.30, "currency": "EUR"}'::jsonb,
        DATE '2026-07-29');

-- Devis numérotés + compteur -------------------------------------------------
INSERT INTO quotes (id, organization_id, user_id, project_id, client_id,
                    estimation_id, quote_number, status, material_margin_percent,
                    discount_percent, validity_days, items_json, labor_items_json,
                    subtotal_materials_ht, subtotal_labor_ht, total_ht, tva_rate,
                    total_ttc, sent_at, accepted_at)
VALUES ('40000000-0000-4000-8000-0000000000d1',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000010',
        'c1000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001',
        'D-2026-001', 'accepted', 15.00, 0, 30,
        '[{"material_name": "Peinture acrylique mate", "units_needed": 2,
           "packaging_label": "Pot 5 L", "unit_price_ht": 49.34, "line_total_ht": 98.68}]'::jsonb,
        '[{"label": "Préparation et application", "hours": 14, "hourly_rate": 45.00,
           "line_total_ht": 630.00}]'::jsonb,
        98.68, 630.00, 728.68, 10.00, 801.55,
        TIMESTAMPTZ '2026-07-20 09:12:00+00', TIMESTAMPTZ '2026-07-22 16:40:00+00'),
       ('40000000-0000-4000-8000-0000000000d2',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000010',
        'c1000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001',
        'D-2026-002', 'sent', 15.00, 5.00, 30,
        '[{"material_name": "Sous-couche universelle", "units_needed": 1,
           "packaging_label": "Pot 2,5 L", "unit_price_ht": 28.18, "line_total_ht": 28.18}]'::jsonb,
        '[]'::jsonb,
        28.18, 0, 26.77, 20.00, 32.12,
        TIMESTAMPTZ '2026-08-01 08:00:00+00', NULL);

INSERT INTO quote_sequences (organization_id, year, last_number)
VALUES ('a0000000-0000-4000-8000-000000000001', 2026, 2);

-- Facture numérotée + compteur ----------------------------------------------
INSERT INTO invoices (id, organization_id, user_id, quote_id, project_id, client_id,
                      invoice_number, invoice_type, status, source_quote_number,
                      issued_on, supply_date, due_on, currency,
                      seller_snapshot, buyer_snapshot, items_json, vat_breakdown,
                      total_ht, total_tva, total_ttc, payment_terms, late_penalty_rate)
VALUES ('40000000-0000-4000-8000-0000000000f1',
        'a0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-0000000000d1',
        'a0000000-0000-4000-8000-000000000010',
        'c1000000-0000-4000-8000-000000000001',
        'F-2026-0001', 'solde', 'issued', 'D-2026-001',
        DATE '2026-07-25', DATE '2026-07-24', DATE '2026-08-24', 'EUR',
        '{"raison_sociale": "Drill Rénovation SARL", "siret": "12345678900012",
          "address_line1": "12 rue des Éprouvettes", "postal_code": "75011",
          "city": "Paris", "vat_number": "FR12345678900"}'::jsonb,
        '{"name": "Madame Aurélie Dupré", "address_line1": "3 impasse du Béton",
          "postal_code": "75012", "city": "Paris"}'::jsonb,
        '[{"kind": "material", "label": "Peinture acrylique mate", "quantity": 2,
           "unit_price_ht": 49.34, "line_total_ht": 98.68},
          {"kind": "labor", "label": "Préparation et application", "quantity": 14,
           "unit_price_ht": 45.00, "line_total_ht": 630.00}]'::jsonb,
        '[{"rate": 10.00, "base_ht": 728.68, "tva": 72.87}]'::jsonb,
        728.68, 72.87, 801.55, 'Paiement à 30 jours', 10.50);

-- 1 et non 2 : la numérotation de facture n'admet pas de trou (art. 242
-- nonies A CGI), donc le compteur vaut exactement le nombre de factures émises.
-- Celui des devis, lui, peut en avoir — c'est le verrou qu'on y cherche, pas la
-- continuité (cf. QuotesService.allocateQuoteNumber).
INSERT INTO invoice_sequences (organization_id, year, last_number)
VALUES ('a0000000-0000-4000-8000-000000000001', 2026, 1);

COMMIT;
