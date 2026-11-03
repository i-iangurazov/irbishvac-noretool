"""Portable replacement for the macOS-only PDF join action."""
from __future__ import annotations
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("inputs", nargs="+")
    args=parser.parse_args()
    output=Path(args.output)
    writer=PdfWriter()
    expected=0
    for name in args.inputs:
        reader=PdfReader(name)
        expected+=len(reader.pages)
        writer.append(reader)
    temporary=output.with_suffix(".pdf.tmp")
    with temporary.open("wb") as handle:
        writer.write(handle)
    if len(PdfReader(temporary).pages) != expected:
        raise ValueError("Combined PDF page count differs from its source reports")
    temporary.replace(output)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
