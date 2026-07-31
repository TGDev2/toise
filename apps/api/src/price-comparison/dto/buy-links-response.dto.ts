export interface BuyLinkItem {
  material_id: string;
  supplier_key: string;
  supplier_name: string;
  url: string;
}

export interface BuyLinksResponseDto {
  links: BuyLinkItem[];
}
