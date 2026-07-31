import { CsvRowParser } from './csv-row-parser';

function parse(chunks: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const parser = new CsvRowParser((record) => rows.push(record));
  for (const chunk of chunks) {
    parser.push(chunk);
  }
  parser.end();
  return rows;
}

describe('CsvRowParser', () => {
  it('parses a comma-delimited feed', () => {
    expect(parse(['id,name,price\n1,Peinture,34.90\n2,Colle,19.90\n'])).toEqual(
      [
        { id: '1', name: 'Peinture', price: '34.90' },
        { id: '2', name: 'Colle', price: '19.90' },
      ],
    );
  });

  it('detects a semicolon delimiter', () => {
    expect(parse(['id;name;price\n1;Peinture;34,90\n'])).toEqual([
      { id: '1', name: 'Peinture', price: '34,90' },
    ]);
  });

  it('detects a tab delimiter', () => {
    expect(parse(['id\tname\n1\tPeinture\n'])).toEqual([
      { id: '1', name: 'Peinture' },
    ]);
  });

  it('keeps a delimiter that sits inside a quoted field', () => {
    expect(parse(['id,name\n1,"Peinture mate, blanche, 2,5 L"\n'])).toEqual([
      { id: '1', name: 'Peinture mate, blanche, 2,5 L' },
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parse(['id,name\n1,"Lame 2"" pouces"\n'])).toEqual([
      { id: '1', name: 'Lame 2" pouces' },
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(
      parse(['id,description\n1,"Ligne un\nLigne deux"\nid2,x\n']),
    ).toEqual([
      { id: '1', description: 'Ligne un\nLigne deux' },
      { id: 'id2', description: 'x' },
    ]);
  });

  it('tolerates CRLF line endings', () => {
    expect(parse(['id,name\r\n1,Peinture\r\n'])).toEqual([
      { id: '1', name: 'Peinture' },
    ]);
  });

  it('emits the last row when the feed has no trailing newline', () => {
    expect(parse(['id,name\n1,Peinture'])).toEqual([
      { id: '1', name: 'Peinture' },
    ]);
  });

  it('normalises header names', () => {
    const rows = parse([
      'AW Product ID,"Search Price",Merchant-Category\n1,10,Peinture\n',
    ]);
    expect(rows[0]).toEqual({
      aw_product_id: '1',
      search_price: '10',
      merchant_category: 'Peinture',
    });
  });

  it('strips a UTF-8 BOM from the first header', () => {
    const rows = parse([`${String.fromCharCode(0xfeff)}id,name\n1,Peinture\n`]);
    expect(rows[0]).toEqual({ id: '1', name: 'Peinture' });
  });

  it('is unaffected by chunk boundaries', () => {
    // Le flux arrive par paquets réseau : les coupures tombent au milieu des
    // champs, des guillemets et de la ligne d'en-tête.
    const whole = 'id,name\n1,"Peinture mate, 2,5 L"\n2,Colle\n';
    const expected = parse([whole]);

    for (const size of [1, 3, 7, 13]) {
      const chunks: string[] = [];
      for (let i = 0; i < whole.length; i += size) {
        chunks.push(whole.slice(i, i + size));
      }
      expect(parse(chunks)).toEqual(expected);
    }
  });

  it('pads a short row and ignores extra columns', () => {
    expect(parse(['a,b,c\n1,2\n'])).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('skips blank lines', () => {
    expect(parse(['id,name\n\n1,Peinture\n\n'])).toEqual([
      { id: '1', name: 'Peinture' },
    ]);
  });

  it('yields nothing for a header-only feed', () => {
    expect(parse(['id,name\n'])).toEqual([]);
  });
});
