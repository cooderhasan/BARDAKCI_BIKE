import sys
import os
from pypdf import PdfReader

def extract_text_from_pdf(pdf_path, output_txt_path):
    print(f"Reading PDF from: {pdf_path}")
    reader = PdfReader(pdf_path)
    
    with open(output_txt_path, 'w', encoding='utf-8') as f:
        for i, page in enumerate(reader.pages):
            f.write(f"\n--- Page {i+1} ---\n")
            text = page.extract_text()
            if text:
                f.write(text)
            else:
                f.write("[No text extracted from this page]\n")
    print(f"Extraction complete! Saved to {output_txt_path}")

if __name__ == "__main__":
    pdf_file = "d:/SRN/TestSprite.pdf"
    output_file = "d:/SRN/scratch/pdf_content.txt"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    extract_text_from_pdf(pdf_file, output_file)
