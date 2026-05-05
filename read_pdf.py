import PyPDF2
import sys

def extract_pdf_text(filepath):
    try:
        with open(filepath, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ''
            for i, page in enumerate(reader.pages):
                text += f"\n--- Page {i+1} ---\n"
                text += page.extract_text()
        with open('pdf_content.txt', 'w', encoding='utf-8') as out_file:
            out_file.write(text)
        print("Successfully written to pdf_content.txt")
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        extract_pdf_text(sys.argv[1])
    else:
        print("Please provide a PDF file path.")
