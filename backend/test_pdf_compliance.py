"""
Test PDF compliance evaluation with two PDFs:
1. Compliant course report (has all required sections)
2. Non-compliant document (missing most required sections)
"""
import asyncio
import io
import json
import sys
sys.path.insert(0, ".")

from fpdf import FPDF
import pdfplumber

from app.services.ai_service import (
    analyze_task_against_standards,
    get_pdf_formatting_prompt,
    get_report_type_context,
    REPORT_TYPES,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_bytes: bytes) -> str:
    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            tables = page.extract_tables() or []
            table_text = ""
            for table in tables:
                for row in table:
                    if row:
                        table_text += " | ".join(str(c or "") for c in row) + "\n"
            combined = text + ("\n[TABLE]\n" + table_text if table_text else "")
            if combined.strip():
                pages.append(f"[Page {i+1}]\n{combined.strip()}")
    return "\n\n".join(pages)


# ---------------------------------------------------------------------------
# PDF 1 — COMPLIANT course report
# ---------------------------------------------------------------------------

def build_compliant_pdf() -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    # --- Cover Page ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Cairo University", ln=True, align="C")
    pdf.cell(0, 10, "Faculty of Engineering", ln=True, align="C")
    pdf.cell(0, 10, "Department of Computer Engineering", ln=True, align="C")
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Quality Assurance Unit", ln=True, align="C")
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "Course Report", ln=True, align="C")
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 8, "Course: Introduction to Algorithms (CS301)", ln=True, align="C")
    pdf.cell(0, 8, "Academic Year: 2024 - 2025", ln=True, align="C")
    pdf.cell(0, 8, "Semester: First Semester", ln=True, align="C")
    pdf.cell(0, 8, "Date of Issue: January 2025", ln=True, align="C")
    pdf.ln(10)
    pdf.cell(0, 8, "Prepared by: Dr. Ahmed Hassan", ln=True)
    pdf.cell(0, 8, "Reviewed by: Prof. Mohamed Ali", ln=True)
    pdf.cell(0, 8, "Approved by: Dean of Faculty", ln=True)

    # --- Table of Contents ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Table of Contents", ln=True)
    pdf.set_font("Helvetica", size=11)
    toc = [
        ("1. Introduction", 3),
        ("2. Course Basic Information", 3),
        ("3. Teaching Staff", 4),
        ("4. Intended Learning Outcomes", 4),
        ("5. Course Delivery Analysis", 5),
        ("6. Student Performance Statistics", 5),
        ("7. Grade Distribution Tables", 6),
        ("8. Comparison with Previous Years", 6),
        ("9. Student Feedback Analysis", 7),
        ("10. Difficulties and Challenges", 7),
        ("11. Improvement Actions", 8),
        ("12. External Reviewer Comments", 8),
        ("13. Appendices", 9),
        ("14. Signatures and Approvals", 9),
    ]
    for title, page in toc:
        pdf.cell(0, 7, f"{title} {'.' * (50 - len(title))} {page}", ln=True)

    # --- Introduction ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "1. Introduction", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Purpose: This report presents a comprehensive review of the CS301 course "
        "for the academic year 2024-2025, first semester.\n\n"
        "Scope: The report covers all aspects of course delivery including student "
        "performance, learning outcomes attainment, and feedback analysis.\n\n"
        "Methodology: Data was collected from examination records, student surveys, "
        "and instructor observations throughout the semester.\n\n"
        "Reporting Period: September 2024 to January 2025."
    )

    # --- Course Basic Information ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "2. Course Basic Information", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Course Code: CS301\nCourse Name: Introduction to Algorithms\n"
        "Credit Hours: 3\nContact Hours: 45 hours\nPrerequisites: CS201 Data Structures"
    )

    # --- Teaching Staff ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "3. Teaching Staff", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7, "Course Instructor: Dr. Ahmed Hassan (PhD, Computer Science)\n"
                         "Teaching Assistants: Eng. Sara Mohamed, Eng. Karim Youssef")

    # --- ILOs ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "4. Intended Learning Outcomes (ILOs)", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "By the end of this course, students should be able to:\n"
        "  a) Analyze time and space complexity of algorithms.\n"
        "  b) Design and implement sorting and searching algorithms.\n"
        "  c) Apply dynamic programming and greedy techniques.\n"
        "  d) Evaluate algorithm correctness using proof techniques."
    )

    # --- Student Performance Statistics ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "5. Student Performance Statistics", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Total Enrolled Students: 120\n"
        "Students Passed: 98  (81.7%)\n"
        "Students Failed: 22  (18.3%)\n"
        "Highest Grade: 98/100\n"
        "Lowest Grade: 22/100\n"
        "Class Average: 71.4/100\n\n"
        "Level of adherence to course specification: 92% compliance confirmed."
    )

    # --- Grade Distribution Table ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "6. Grade Distribution Table", ln=True)
    pdf.set_font("Helvetica", "B", 11)
    col_w = [40, 30, 30, 30]
    headers = ["Grade Range", "Count", "Percentage", "Remarks"]
    for h, w in zip(headers, col_w):
        pdf.cell(w, 8, h, border=1, align="C")
    pdf.ln()
    pdf.set_font("Helvetica", size=10)
    rows = [
        ("A  (90-100)", "18", "15%", "Excellent"),
        ("B  (80-89)", "35", "29.2%", "Very Good"),
        ("C  (70-79)", "28", "23.3%", "Good"),
        ("D  (60-69)", "17", "14.2%", "Pass"),
        ("F  (0-59)", "22", "18.3%", "Fail"),
    ]
    for row in rows:
        for val, w in zip(row, col_w):
            pdf.cell(w, 7, val, border=1, align="C")
        pdf.ln()

    # --- Comparison with Previous Years ---
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "7. Comparison with Previous Years", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Academic Year 2022-2023: Pass rate 76.5%\n"
        "Academic Year 2023-2024: Pass rate 79.2%\n"
        "Academic Year 2024-2025: Pass rate 81.7%\n\n"
        "Trend: Consistent improvement in pass rate (+2.5% per year). "
        "Assessment fairness indicators show balanced distribution."
    )

    # --- Student Feedback ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "8. Student Feedback Analysis", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Survey Response Rate: 87% (104/120 students)\n\n"
        "Overall Course Satisfaction: 4.1/5.0\n"
        "Instructor Effectiveness: 4.3/5.0\n"
        "Course Material Quality: 3.9/5.0\n"
        "Assessment Fairness: 4.0/5.0\n\n"
        "Key Feedback: Students requested more practice problems and office hours."
    )

    # --- Difficulties & Challenges ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "9. Difficulties and Challenges", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "1. High failure rate in dynamic programming topics (42% scored below 60% in DP section).\n"
        "2. Limited lab resources for algorithm simulation exercises.\n"
        "3. Students struggled with mathematical proof techniques."
    )

    # --- Improvement Actions ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "10. Improvement Actions", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "1. Add 2 extra tutorial sessions on dynamic programming (Responsible: Dr. Ahmed, Timeline: Next semester).\n"
        "2. Develop an online exercise bank with 200+ practice problems (Responsible: Teaching team, Timeline: 3 months).\n"
        "3. Request additional computer lab allocation from the Faculty Dean."
    )

    # --- External Reviewer Comments ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "11. External Reviewer Comments", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Reviewer: Prof. Khaled Ibrahim (Alexandria University)\n"
        "Review Date: December 2024\n\n"
        "Strengths: Course content is comprehensive and well-aligned with ILOs.\n"
        "Weaknesses: Assessment methods could include more project-based evaluation.\n"
        "Recommendation: Introduce a mini-project component worth 15% of total grade."
    )

    # --- Conclusion ---
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "12. Conclusion", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Summary of Findings: The course demonstrated a positive improvement trend "
        "with 81.7% pass rate, up from 79.2% last year.\n\n"
        "Conclusions: The course specification is being followed with 92% compliance. "
        "Dynamic programming remains a challenge area requiring additional support.\n\n"
        "Improvement Priorities: DP tutorial sessions, online practice bank, and "
        "project-based assessment component."
    )

    # --- Appendices ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "13. Appendices", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Appendix A: Student Survey Form\n"
        "Appendix B: Full Grade Sheet\n"
        "Appendix C: External Reviewer Report\n"
        "Appendix D: Attendance Sheets\n"
        "Appendix E: Department Council Approval Minutes"
    )

    # --- Signatures & Approvals ---
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "14. Signatures and Approvals", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 7,
        "Prepared by: Dr. Ahmed Hassan          Signature: ____________  Date: Jan 15, 2025\n\n"
        "Reviewed by: Prof. Mohamed Ali          Signature: ____________  Date: Jan 20, 2025\n\n"
        "Approved by: Dean of Faculty            Stamp: [Official Stamp]   Date: Jan 25, 2025\n\n"
        "Department Council Approval: Resolution No. 12/2025 dated January 22, 2025"
    )

    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# PDF 2 — NON-COMPLIANT document
# ---------------------------------------------------------------------------

def build_non_compliant_pdf() -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, "CS301 Summary Notes", ln=True)
    pdf.ln(5)
    pdf.multi_cell(0, 8,
        "This is a brief summary of the CS301 course.\n\n"
        "Students: some passed, some failed.\n\n"
        "The course covered algorithms. It was okay.\n\n"
        "We had some issues with students not understanding dynamic programming.\n\n"
        "Next time we will try to do better."
    )
    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# Run test
# ---------------------------------------------------------------------------

STANDARDS_RULES = [
    {"rule": "Student results analysis with statistics must be present", "category": "content", "is_active": True},
    {"rule": "Pass and fail rates with comparison to previous years must be included", "category": "content", "is_active": True},
    {"rule": "Level of adherence to course specification must be documented", "category": "content", "is_active": True},
    {"rule": "Development and improvement proposals must be actionable and measurable", "category": "content", "is_active": True},
    {"rule": "Assessment methods evaluation must be included", "category": "content", "is_active": True},
    {"rule": "External reviewer comments must be present", "category": "content", "is_active": True},
    {"rule": "Student feedback analysis with response rate must be documented", "category": "content", "is_active": True},
    {"rule": "Signatures and official approvals must be present", "category": "formatting", "is_active": True},
    {"rule": "Cover page with university, faculty, department and date must exist", "category": "formatting", "is_active": True},
    {"rule": "Table of contents must be present and organized", "category": "formatting", "is_active": True},
]


async def run_test():
    compliant_bytes = build_compliant_pdf()
    non_compliant_bytes = build_non_compliant_pdf()

    compliant_text = extract_pdf_text(compliant_bytes)
    non_compliant_text = extract_pdf_text(non_compliant_bytes)

    report_type_context = get_report_type_context("course_report")
    formatting_prompt   = get_pdf_formatting_prompt("course_report")

    file_compliant = [{
        "file_name": "compliant_course_report.pdf",
        "content": compliant_text[:8000],
        "file_type": "pdf",
    }]
    file_non_compliant = [{
        "file_name": "non_compliant_document.pdf",
        "content": non_compliant_text[:8000],
        "file_type": "pdf",
    }]

    print("\n" + "="*60)
    print("TEST 1: COMPLIANT PDF")
    print("="*60)
    result1 = await analyze_task_against_standards(
        task_title="Course Report - CS301 Introduction to Algorithms",
        task_description="Annual course report for CS301",
        standards_rules=STANDARDS_RULES,
        file_texts=file_compliant,
        report_type="course_report",
    )
    print(f"Compliance Score     : {result1.get('compliance_score')}%")
    print(f"Passed Standards     : {len(result1.get('passed_standards', []))}")
    print(f"Failed Standards     : {len(result1.get('failed_standards', []))}")
    fmt = result1.get("formatting_compliance", {})
    if fmt:
        print(f"Formatting Score     : {fmt.get('formatting_score')}%")
        print(f"Missing Sections     : {fmt.get('missing_sections', [])}")
        print(f"Formatting Strengths : {fmt.get('formatting_strengths', [])}")
        print(f"Formatting Weaknesses: {fmt.get('formatting_weaknesses', [])}")
    print(f"Suggestions          :")
    for s in result1.get("suggestions", []):
        print(f"  - {s}")

    print("\n" + "="*60)
    print("TEST 2: NON-COMPLIANT PDF")
    print("="*60)
    result2 = await analyze_task_against_standards(
        task_title="CS301 Summary Notes",
        task_description="Brief summary document",
        standards_rules=STANDARDS_RULES,
        file_texts=file_non_compliant,
        report_type="course_report",
    )
    print(f"Compliance Score     : {result2.get('compliance_score')}%")
    print(f"Passed Standards     : {len(result2.get('passed_standards', []))}")
    print(f"Failed Standards     : {len(result2.get('failed_standards', []))}")
    fmt2 = result2.get("formatting_compliance", {})
    if fmt2:
        print(f"Formatting Score     : {fmt2.get('formatting_score')}%")
        print(f"Missing Sections     : {fmt2.get('missing_sections', [])}")
        print(f"Formatting Weaknesses: {fmt2.get('formatting_weaknesses', [])}")
    print(f"Failed Rules         :")
    for f in result2.get("failed_standards", []):
        print(f"  - {f.get('rule')}: {f.get('reason')}")
    print(f"Suggestions          :")
    for s in result2.get("suggestions", []):
        print(f"  - {s}")

    print("\n" + "="*60)
    print("COMPARISON SUMMARY")
    print("="*60)
    s1 = result1.get('compliance_score', 0)
    s2 = result2.get('compliance_score', 0)
    print(f"Compliant PDF score    : {s1}%  ({'PASS' if s1 >= 70 else 'FAIL'})")
    print(f"Non-compliant PDF score: {s2}%  ({'PASS' if s2 >= 70 else 'FAIL'})")
    print(f"Score difference       : {s1 - s2:.1f}%")


if __name__ == "__main__":
    asyncio.run(run_test())
