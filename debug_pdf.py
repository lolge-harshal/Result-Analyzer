"""Quick test of the legacy parser against the real PDF."""
import sys
sys.path.insert(0, '.')
from server import parse_pdf_legacy

pdf_path = "/Users/lolgeharshal/Downloads/B.Tech (CSE (AI and ML))_3(DECEMBER_2025) - CR Report.pdf"

with open(pdf_path, 'rb') as f:
    result = parse_pdf_legacy(f)

print(f"\nSubjects ({len(result['subjects'])}):", result['subjects'])
print(f"\nFirst 5 students:")
for s in result['students'][:5]:
    print(f"\n  {s['seat']} | {s['name']} | {s['result']} | total={s['total']} | sgpa={s['sgpa']}")
    print(f"  marks : {s['marks']}")
    print(f"  grades: {s['grades']}")
