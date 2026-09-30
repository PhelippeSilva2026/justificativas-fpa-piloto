declare module 'opentype.js' {
  export class Path {
    extend(path: Path): void;
    toPathData(decimalPlaces?: number): string;
  }

  export interface Glyph {
    advanceWidth?: number;
    getPath(x?: number, y?: number, fontSize?: number): Path;
  }

  export interface Font {
    unitsPerEm: number;
    charToGlyph(c: string): Glyph;
    getKerningValue(leftGlyph: Glyph, rightGlyph: Glyph): number;
    getPath(text: string, x?: number, y?: number, fontSize?: number): Path;
  }

  export function parse(buffer: ArrayBuffer): Font;

  const opentype: {
    Path: typeof Path;
    parse: typeof parse;
  };

  export default opentype;
}
