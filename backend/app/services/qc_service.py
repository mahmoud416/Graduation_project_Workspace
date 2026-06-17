"""
AI Service for Quality Control analysis using Google Gemini API.
Handles text analysis, image analysis, roadmap suggestions, and web search.
Includes offline fallback when Gemini API is unavailable.
"""
import asyncio
import base64
import json
import re
from datetime import datetime
from typing import List, Optional, Any

from app.core.config import settings
from app.db.collections import AI_MODEL_STATE_COLLECTION


# ---------------------------------------------------------------------------
# Accreditation Report Types — used to validate task submissions
# ---------------------------------------------------------------------------

REPORT_TYPES: dict = {
    "course_report": {
        "name_ar": "تقرير المقرر الدراسي",
        "name_en": "Course Report",
        "description": (
            "Annual or semester report submitted per course. Based on the official Egyptian university "
            "accreditation template (نموذج تقرير مقرر 2025), it covers: basic course information, "
            "data & statistics on student performance, student feedback on the course, instructors' "
            "reflection on the educational process, and a course development plan for the next year. "
            "It must be cross-referenced with the corresponding Course Specification (توصيف المقرر) "
            "to verify that what was delivered matches what was planned.\n\n"
            "ACCEPTED IN: Arabic (العربية) or English — both versions are official.\n\n"
            "SYNTHETIC EXAMPLE (condensed):\n"
            "1. Basic Information: Course: Introduction to Algorithms CS301 | Credit Hours: 3 | "
            "Instructor: Dr. Ahmed Hassan | Semester: First 2024-2025\n"
            "2. Data & Statistics: Enrolled: 120 | Pass: 98 (81.7%) | Fail: 22 (18.3%) | "
            "Avg: 71.4 | Grade distribution: A=15%, B=29%, C=23%, D=14%, F=18%\n"
            "3. Student Feedback: Overall satisfaction: 4.1/5 | Scientific content: 4.2 | "
            "Teaching methods: 4.0 | Resources: 3.9 | Exams: 4.0 | Response rate: 87%\n"
            "4. Instructors Reflection: Dynamic programming topics proved challenging. "
            "Lab resources were insufficient for simulation exercises.\n"
            "5. Course Enhancement: Uncompleted actions from last year: extra tutorial sessions "
            "on DP were planned but not fully implemented due to scheduling conflicts.\n"
            "6. Development Plan: Add 2 extra DP sessions | Build online exercise bank (200+ problems) "
            "| Request additional lab allocation | Introduce project-based component."
        ),
        "required_elements": [
            "Basic information: course code, name, credit hours, instructor, semester, academic year",
            "Data and statistics: enrollment numbers, pass/fail rates, grade distribution table",
            "Student feedback: evaluation of scientific content, teaching methods, resources, exams (with response rate)",
            "Instructors reflection: views on educational process, content adequacy, resource sufficiency",
            "Course enhancement: comment on uncompleted corrective actions from last year's plan (if any)",
            "Course development plan for next academic year with specific actionable improvements",
        ],
        "cross_validation": (
            "CROSS-VALIDATION REQUIRED: If a Course Specification (توصيف مقرر) is available or referenced, "
            "verify that: (1) the CLOs stated in the spec were actually assessed in the report, "
            "(2) the teaching methods used match those planned in the spec, "
            "(3) the assessment methods and weights align with the spec, "
            "(4) the course schedule was followed as planned."
        ),
    },
    "program_report": {
        "name_ar": "تقرير البرنامج الدراسي",
        "name_en": "Program Report",
        "description": (
            "Annual report submitted per academic program. Based on the official Egyptian university "
            "accreditation template (نموذج تقرير برنامج 2025), it covers: basic program information, "
            "data & statistics, program quality assessment with KPIs, stakeholder evaluation "
            "(students, faculty, graduates, employers), program enhancement commentary, "
            "and the program action plan for the next academic year. "
            "It must integrate findings from all individual course reports.\n\n"
            "ACCEPTED IN: Arabic (العربية) or English — both versions are official.\n\n"
            "SYNTHETIC EXAMPLE (condensed):\n"
            "1. Basic Information: Program: Computer Engineering | Degree: B.Sc. | Duration: 4 years | "
            "Total Credit Hours: 136 | Academic Year: 2024-2025\n"
            "2. Data & Statistics: Enrolled: 450 | Graduates this year: 98 | Overall pass rate: 79% | "
            "Employment rate of graduates: 82%\n"
            "3. Program Quality Assessment KPIs: Graduate satisfaction: 78% (target 80%, not achieved) | "
            "Employer satisfaction: 83% (target 80%, achieved) | Pass rate: 79% (target 85%, not achieved)\n"
            "Comment on low KPIs: Pass rate below target due to high failure in advanced algorithms courses. "
            "Plan: additional tutorials, revised assessment methods.\n"
            "4. Stakeholder Evaluation: Student survey: 3.9/5 | Faculty survey: 4.1/5 | "
            "Graduate survey: 4.0/5 | Employer survey: 4.2/5\n"
            "5. Program Enhancement: Uncompleted action: industry internship expansion delayed due to MOU negotiations.\n"
            "Comment on course reports: Multiple courses flagged DP and numerical methods as challenge areas.\n"
            "6. Program Action Plan: Revise CS301 assessment | Establish 3 new industry partnerships | "
            "Launch peer-tutoring program | Update curriculum to include AI/ML electives."
        ),
        "required_elements": [
            "Basic information: program name, degree, duration, total credit hours, academic year",
            "Data and statistics: enrollment, graduation numbers, overall pass rates",
            "Program quality assessment: KPI table with targets vs actual results",
            "Commentary on KPIs not achieving targets with explanations",
            "Stakeholder evaluation: results from student, faculty, graduate, and employer surveys (attach questionnaire analysis)",
            "Comment on overall program quality and proposed recommendations",
            "Program enhancement: comment on incomplete corrective actions from last year",
            "Comment on improvement points from individual course reports",
            "Program action plan for next academic year based on assessment results and course reports",
        ],
        "cross_validation": (
            "CROSS-VALIDATION REQUIRED: If a Program Specification (توصيف برنامج) is available or referenced, "
            "verify that: (1) the Program Outcomes (POs) stated in the spec were assessed in the report, "
            "(2) the KPIs listed in the report match those defined in the spec, "
            "(3) the stakeholder evaluation covers all groups mentioned in the spec, "
            "(4) the action plan addresses gaps in PO achievement."
        ),
    },
    "course_specification": {
        "name_ar": "توصيف المقرر الدراسي",
        "name_en": "Course Specification",
        "description": (
            "The official course specification document (توصيف مقرر) describes the planned design of a course "
            "before it is delivered. Based on the official Egyptian university accreditation template "
            "(نموذج توصيف مقرر 2025), it defines: course identity, scientific content overview, "
            "Course Learning Outcomes (CLOs) aligned with Program Outcomes (POs) via the NARS/ARS matrix, "
            "teaching and learning methods, weekly course schedule, student assessment methods with weights, "
            "and required learning resources.\n\n"
            "ACCEPTED IN: Arabic (العربية) or English — both versions are official.\n\n"
            "KEY DISTINCTION: This is a PLANNING document, not a performance report. "
            "It describes what WILL happen, not what happened.\n\n"
            "SYNTHETIC EXAMPLE (condensed):\n"
            "1. Basic Information: Course: Introduction to Algorithms CS301 | Code: CS301 | "
            "Credit Hours: 3 (2 lecture + 1 tutorial) | Prerequisites: CS201 Data Structures | "
            "Program: Computer Engineering | Level: Year 3\n"
            "2. Course Overview: This course introduces fundamental algorithm design paradigms including "
            "divide & conquer, dynamic programming, greedy algorithms, and graph algorithms, "
            "with emphasis on complexity analysis.\n"
            "3. CLOs: CLO1: Analyze time/space complexity (K3) | CLO2: Design sorting & searching algorithms (S2) | "
            "CLO3: Apply dynamic programming and greedy techniques (S3) | CLO4: Evaluate algorithm correctness (S4)\n"
            "4. CLO-PO Matrix: CLO1→PO1,PO2 | CLO2→PO2,PO3 | CLO3→PO3 | CLO4→PO2 (NARS aligned)\n"
            "5. Teaching Methods: Lectures (2hr/week) | Tutorials (1hr/week) | Programming assignments | "
            "Case studies | Peer discussion\n"
            "6. Course Schedule: Week 1-2: Introduction & Complexity | Week 3-4: Divide & Conquer | "
            "Week 5-7: Dynamic Programming | Week 8-9: Greedy | Week 10-12: Graph Algorithms | "
            "Week 13-14: Review & Project | Week 15: Final Exam\n"
            "7. Assessment: Midterm Exam 25% | Final Exam 40% | Assignments 20% | Project 15%\n"
            "8. Learning Resources: Cormen et al. Introduction to Algorithms (textbook) | "
            "Online judge platform | Computer lab (30 PCs)"
        ),
        "required_elements": [
            "Basic information: course code, name, credit hours (lecture/tutorial/practical), prerequisites, program, academic level",
            "Course overview: concise summary of scientific content in Arabic and/or English",
            "Course Learning Outcomes (CLOs): specific, measurable outcomes covering knowledge (K), skills (S), and values/competencies",
            "CLO-PO alignment matrix: mapping each CLO to Program Outcomes using NARS/ARS standards",
            "Teaching and learning methods: list of methods used (lectures, tutorials, labs, projects, etc.)",
            "Course schedule: weekly breakdown of topics covered throughout the semester",
            "Student assessment methods: all assessment types with their percentage weights (must sum to 100%)",
            "Learning resources and supportive facilities: textbooks, e-resources, lab equipment, software",
        ],
        "cross_validation": (
            "SELF-CONSISTENCY CHECK: Verify internal consistency: "
            "(1) Assessment weights must sum to 100%, "
            "(2) Every CLO must appear in the CLO-PO matrix, "
            "(3) Course schedule weeks must cover all topics mentioned in the course overview, "
            "(4) Teaching methods must be sufficient to achieve all stated CLOs, "
            "(5) Assessment methods must evaluate all stated CLOs."
        ),
    },
    "program_specification": {
        "name_ar": "توصيف البرنامج الدراسي",
        "name_en": "Program Specification",
        "description": (
            "The official program specification document (توصيف برنامج) describes the complete design of an "
            "academic program. Based on the official Egyptian university accreditation template "
            "(نموذج توصيف برنامج 2025), it defines: program identity, program aims, full curriculum structure, "
            "program components (core/elective/general), course list by study plan, adopted academic standards "
            "(NARS or ARS with governing council approval), matrix of Program Outcomes (POs) with courses, "
            "teaching and learning strategies, student assessment strategies, and program KPIs.\n\n"
            "ACCEPTED IN: Arabic (العربية) or English — both versions are official.\n\n"
            "KEY DISTINCTION: This is the MASTER PLANNING document for the entire program. "
            "All course specifications and program reports must be consistent with it.\n\n"
            "SYNTHETIC EXAMPLE (condensed):\n"
            "1. Basic Information: Program: Computer Engineering | Degree: B.Sc. | "
            "Duration: 4 years (8 semesters) | Total Credit Hours: 136 | "
            "Faculty: Engineering | Department: Computer Engineering | "
            "Governing Council Approval: Resolution 15/2023\n"
            "2. Program Aims: To produce competent computer engineers capable of designing, implementing, "
            "and evaluating computing systems, with strong mathematical foundations and professional ethics.\n"
            "3. Program Structure: Core Engineering: 80 CH | CS Specialization: 36 CH | "
            "General Education: 12 CH | Free Electives: 8 CH | Total: 136 CH\n"
            "4. Courses by Study Plan: Year 1: Math I, Physics, Programming I, Engineering Drawing... | "
            "Year 2: Data Structures, Algorithms, Networks, OS... | "
            "Year 3: Compilers, AI, Database, Software Engineering... | "
            "Year 4: Graduation Project, Electives...\n"
            "5. Academic Standards: NARS (Computer Engineering) adopted | "
            "ARS alignment matrix attached | Council approval: Jan 15, 2023\n"
            "6. PO-Course Matrix: PO1 (Apply math/science) → CS101, MATH101, PHYS101 | "
            "PO2 (Design computing systems) → CS301, CS401, CS402 | ...\n"
            "7. Teaching Strategies: Problem-based learning | Project-based learning | "
            "Collaborative learning | Laboratory work | Industry internships\n"
            "8. Assessment Strategies: Written exams | Programming projects | Oral presentations | "
            "Portfolio | Graduation project evaluation\n"
            "9. Program KPIs: Graduate employment rate: target 80% | "
            "Student satisfaction: target 4.0/5 | Pass rate: target 85%"
        ),
        "required_elements": [
            "Basic information: program name, degree type, duration, total credit hours, faculty, department, governing council approval date",
            "Program aims: clear description of the overall purpose and intended graduate profile",
            "Program structure and components: breakdown of credit hours by category (core, specialization, general, elective)",
            "Complete course list by study plan (all 4 years / all semesters with course codes and credit hours)",
            "Adopted academic standards: NARS and/or ARS reference with governing council approval date and resolution number",
            "Program Outcomes (POs) to courses mapping matrix: every PO must be covered by at least one course",
            "Teaching and learning strategies: list of strategies used across the program to achieve POs",
            "Student assessment strategies: methods used to verify PO attainment across the program",
            "Program Key Performance Indicators (KPIs): measurable targets for program success",
        ],
        "cross_validation": (
            "SELF-CONSISTENCY CHECK: Verify internal consistency: "
            "(1) Total credit hours in components must match stated total, "
            "(2) Every PO in the matrix must be linked to at least 2 courses, "
            "(3) Academic standards adoption must include council approval evidence, "
            "(4) Course list must match credit hour totals by category, "
            "(5) KPIs must be measurable and aligned with program aims."
        ),
    },
    "self_study": {
        "name_ar": "الدراسة الذاتية",
        "name_en": "Self-Study Report",
        "description": "Comprehensive report describing the college's current status and achievements against all accreditation standards before the accreditation visit.",
        "required_elements": [
            "Current status of the institution against all accreditation standards",
            "Achievements and evidence of compliance",
            "Strengths and areas for improvement",
            "Must be in Arabic language",
            "Approved by official councils",
        ],
    },
    "execution_plan_followup": {
        "name_ar": "تقارير متابعة الخطة التنفيذية",
        "name_en": "Execution Plan Follow-up Reports",
        "description": "Periodic (annual or semi-annual) reports tracking progress in implementing strategic plan activities and achieving targets.",
        "required_elements": [
            "Progress status for each strategic activity",
            "Achievement percentage for each target",
            "Obstacles and corrective actions",
            "Timeline compliance assessment",
            "Next period action plan",
        ],
    },
    "survey_analysis": {
        "name_ar": "تقارير تحليل الاستبيانات",
        "name_en": "Survey Analysis Reports",
        "description": "Analysis of opinion surveys from students, faculty, graduates, employers, and administrators about the learning environment.",
        "required_elements": [
            "Survey sample size and response rate",
            "Statistical analysis of responses",
            "Satisfaction levels per category",
            "Comparison with previous periods",
            "Recommendations based on findings",
        ],
    },
    "exam_results_analysis": {
        "name_ar": "تقارير تحليل نتائج الامتحانات",
        "name_en": "Exam Results Analysis Reports",
        "description": "Statistical analysis of exam results to monitor assessment fairness and compare with previous years.",
        "required_elements": [
            "Grade distribution statistics",
            "Comparison with previous years",
            "Assessment fairness indicators",
            "High failure rate analysis",
            "Remedial action recommendations",
        ],
    },
    "reviewer_reports": {
        "name_ar": "تقارير المراجعين",
        "name_en": "Reviewer Reports (Internal & External)",
        "description": "Reports by experts after reviewing program and course specifications and reports to identify academic strengths and weaknesses.",
        "required_elements": [
            "Reviewer qualifications and credentials",
            "Review of course/program specifications",
            "Identified strengths",
            "Identified weaknesses and gaps",
            "Recommendations for improvement",
        ],
    },
    "financial_reports": {
        "name_ar": "التقارير المالية",
        "name_en": "Financial Reports",
        "description": "Tables showing institutional resources, expenditures, adequacy for achieving the mission, with comparison of self-generated resources over 3 years.",
        "required_elements": [
            "Revenue and expenditure breakdown",
            "Resource adequacy assessment",
            "3-year comparison of self-generated resources",
            "Budget alignment with strategic goals",
            "Financial sustainability indicators",
        ],
    },
    "field_training_reports": {
        "name_ar": "تقارير التدريب الميداني",
        "name_en": "Field Training Reports",
        "description": "Includes student achievement reports, academic supervisor evaluations, and external training organization reports on student performance.",
        "required_elements": [
            "Student achievement report (Injaz)",
            "Academic supervisor evaluation",
            "External training organization feedback",
            "Skills acquired during training",
            "Training outcomes assessment",
        ],
    },
    "student_activities": {
        "name_ar": "تقارير الأنشطة الطلابية",
        "name_en": "Student Activities Reports",
        "description": "Annual documentation of student participation in competitions and awards at university, national, and international levels.",
        "required_elements": [
            "List of competitions and events participated in",
            "Awards and achievements won",
            "University/national/international level classification",
            "Number of participating students",
            "Impact on student development",
        ],
    },
    "hr_performance": {
        "name_ar": "تقارير تقييم الأداء البشري",
        "name_en": "HR Performance Evaluation Reports",
        "description": "Periodic reports evaluating the performance of academic leaders (dean/deputies), faculty members, and administrative staff.",
        "required_elements": [
            "Performance criteria and evaluation method",
            "Individual performance scores",
            "Coverage of all staff categories",
            "Development recommendations",
            "Action plan for low performers",
        ],
    },
    "training_plans_execution": {
        "name_ar": "تقارير تنفيذ خطط التدريب",
        "name_en": "Training Plans Execution Reports",
        "description": "Inventory of executed training courses, number of trainees per category, and measurement of training impact on performance.",
        "required_elements": [
            "List of executed training courses",
            "Number of trainees per staff category",
            "Training impact measurement on performance",
            "Training plan vs actual execution comparison",
            "Return on investment indicators",
        ],
    },
    "qa_unit_annual": {
        "name_ar": "التقرير السنوي لوحدة ضمان الجودة",
        "name_en": "QA Unit Annual Report",
        "description": "Documents unit activities, periodic meetings, database updates, and results of the institution's self-evaluation.",
        "required_elements": [
            "QA unit activities during the year",
            "Periodic meeting minutes and outcomes",
            "Database updates and maintenance",
            "Self-evaluation results",
            "Improvement actions taken",
        ],
    },
    "student_data_reports": {
        "name_ar": "تقارير بيانات الطلاب والوافدين",
        "name_en": "Student and International Students Data Reports",
        "description": "Statistics on admitted students, transfer rates, and trends in international student numbers over 3-5 years.",
        "required_elements": [
            "Admitted students statistics",
            "Transfer rates and ratios",
            "International student numbers trend (3-5 years)",
            "Enrollment by program and year",
            "Demographic breakdown",
        ],
    },
    "research_activity": {
        "name_ar": "تقارير حصر النشاط البحثي",
        "name_en": "Research Activity Reports",
        "description": "Inventory of theses, internationally and locally published research, conferences, and research projects over the last 3 years.",
        "required_elements": [
            "List of scientific theses",
            "Internationally published research",
            "Locally published research",
            "Conferences and symposia",
            "Research projects and grants",
        ],
    },
    "research_ethics": {
        "name_ar": "تقرير لجنة أخلاقيات البحث العلمي",
        "name_en": "Research Ethics Committee Report",
        "description": "Annual report showing the number of approved research and adherence to academic integrity standards.",
        "required_elements": [
            "Number of research proposals reviewed",
            "Number of approved/rejected research",
            "Academic integrity compliance indicators",
            "Cases of misconduct and actions taken",
            "Committee activities and meetings",
        ],
    },
    "physical_resources": {
        "name_ar": "نماذج تقييم الموارد المادية",
        "name_en": "Physical Resources Evaluation Forms",
        "description": "Field reports evaluating the condition of classrooms, labs, library, medical clinic, and restrooms.",
        "required_elements": [
            "Classroom condition assessment",
            "Laboratory equipment and adequacy",
            "Library resources evaluation",
            "Support facilities assessment (clinic, restrooms)",
            "Maintenance needs and recommendations",
        ],
    },
    "community_engagement": {
        "name_ar": "تقارير المشاركة المجتمعية",
        "name_en": "Community Engagement Reports",
        "description": "Reports on community service center activities, outreach convoys, and consultations provided to the surrounding community.",
        "required_elements": [
            "Community service center activities",
            "Outreach convoys and events",
            "Consultations provided to community",
            "Number of beneficiaries",
            "Impact assessment on community",
        ],
    },

    # -----------------------------------------------------------------------
    # ISO 9001:2015 Report Types — visible only to users with the "iso-9001" role.
    # Each description embeds the full ISO-auditor evaluation context that
    # get_report_type_context() feeds to the LLM: persona, purpose, weighted
    # compliance criteria (totaling 100%), failure conditions, optional fields,
    # and evidence-extraction rules. required_elements = mandatory fields.
    # -----------------------------------------------------------------------
    "iso_ncr": {
        "name_ar": "تقرير عدم المطابقة",
        "name_en": "Non-Conformity Report (NCR)",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "strictly against ISO 9001:2015 Clause 10.2 (Nonconformity and corrective action). "
            "Rely ONLY on evidence found in the document; never invent facts. If a field is "
            "missing or ambiguous, mark it as NOT FOUND rather than assuming.\n\n"
            "PURPOSE: Document a detected nonconformity — what failed, where, when, against which "
            "requirement — so it can be contained and routed to corrective action.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - NCR identification & traceability (unique ID, date, raised-by, source): 15%\n"
            "  - Clear description of the nonconformity (what, where, when): 25%\n"
            "  - Reference to the violated requirement (ISO clause / procedure / spec): 20%\n"
            "  - Immediate containment / correction taken: 20%\n"
            "  - Severity / classification (major vs minor) with justification: 10%\n"
            "  - Disposition of affected product/process and responsible owner: 10%\n\n"
            "FAILURE CONDITIONS (auto non-compliant if any are true): no unique NCR ID; "
            "nonconformity not described in objective terms; no reference to a violated "
            "requirement; no containment/correction recorded; no responsible owner assigned.\n\n"
            "OPTIONAL FIELDS (do not penalize if absent): photos/attachments, cost impact, "
            "customer-notification flag, related CAPA reference.\n\n"
            "EVIDENCE EXTRACTION RULES: Quote the exact text proving each criterion. For dates "
            "and IDs extract verbatim. If the violated requirement is implied but not cited, "
            "treat the clause-reference criterion as partially met, not fully met."
        ),
        "required_elements": [
            "Unique NCR identifier and date raised",
            "Objective description of the nonconformity (what, where, when)",
            "Reference to the violated requirement (ISO clause, procedure, or specification)",
            "Immediate containment or correction action taken",
            "Severity classification (major / minor) with justification",
            "Disposition of affected product/process and responsible owner",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_capa": {
        "name_ar": "تقرير الإجراء التصحيحي والوقائي",
        "name_en": "Corrective Action Report (CAPA)",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 10.2 (corrective action) and Clause 10.3 (continual improvement). "
            "Use only evidence in the document; flag missing/ambiguous data as NOT FOUND.\n\n"
            "PURPOSE: Demonstrate that a nonconformity was investigated to root cause, that "
            "actions were taken to eliminate recurrence, and that effectiveness was verified.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Link to originating NCR / problem statement: 10%\n"
            "  - Root-cause analysis using a recognized method (5-Whys, fishbone, etc.): 25%\n"
            "  - Defined corrective action(s) addressing the root cause: 20%\n"
            "  - Responsibilities and target completion dates: 15%\n"
            "  - Implementation evidence (actions actually completed): 15%\n"
            "  - Effectiveness verification / recurrence check: 15%\n\n"
            "FAILURE CONDITIONS: no root-cause analysis (only symptom fixing); corrective "
            "action does not address the stated root cause; no owner or due date; no "
            "effectiveness verification recorded.\n\n"
            "OPTIONAL FIELDS: preventive actions for similar processes, updates to risk "
            "register, lessons-learned, cost of poor quality.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract the stated root cause verbatim and confirm the "
            "corrective action logically targets it. If effectiveness verification is planned "
            "but not yet evidenced, score that criterion as partial."
        ),
        "required_elements": [
            "Reference to the originating nonconformity or problem statement",
            "Root-cause analysis using a recognized method",
            "Corrective action(s) that address the identified root cause",
            "Assigned responsibilities and target completion dates",
            "Evidence of implementation",
            "Effectiveness verification confirming no recurrence",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_internal_audit": {
        "name_ar": "تقرير التدقيق الداخلي",
        "name_en": "Internal Audit Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 9.2 (Internal audit). Rely solely on documented evidence.\n\n"
            "PURPOSE: Provide objective evidence that the QMS conforms to ISO 9001 and to the "
            "organization's own requirements, and that it is effectively implemented.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Audit scope, criteria, and objectives defined: 15%\n"
            "  - Audit plan / schedule and auditor independence stated: 15%\n"
            "  - Areas / processes / clauses audited with dates: 15%\n"
            "  - Findings classified (conformity, NC, OFI) with objective evidence: 25%\n"
            "  - Nonconformities linked to corrective-action requests: 15%\n"
            "  - Audit conclusion / overall QMS effectiveness statement: 15%\n\n"
            "FAILURE CONDITIONS: no defined scope or criteria; auditor not independent of the "
            "area audited; findings stated without objective evidence; no conclusion on QMS "
            "effectiveness.\n\n"
            "OPTIONAL FIELDS: opening/closing meeting records, auditee acknowledgements, "
            "follow-up audit reference, positive observations.\n\n"
            "EVIDENCE EXTRACTION RULES: For each finding extract the clause referenced and the "
            "objective evidence cited. Distinguish nonconformities from opportunities for "
            "improvement; do not upgrade an OFI to an NC without explicit evidence."
        ),
        "required_elements": [
            "Audit scope, criteria, and objectives",
            "Audit plan/schedule and statement of auditor independence",
            "Processes/areas/clauses audited with dates",
            "Findings classified as conformity, nonconformity, or opportunity for improvement, each with objective evidence",
            "Nonconformities linked to corrective-action requests",
            "Overall audit conclusion on QMS effectiveness",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_supplier_evaluation": {
        "name_ar": "تقرير تقييم الموردين",
        "name_en": "Supplier Evaluation Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 8.4 (Control of externally provided processes, products, services). "
            "Use only documented evidence.\n\n"
            "PURPOSE: Demonstrate that suppliers are selected, evaluated, and re-evaluated based "
            "on their ability to meet requirements, with controls proportional to risk.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Supplier identification and scope of supply: 10%\n"
            "  - Defined evaluation criteria (quality, delivery, price, compliance): 20%\n"
            "  - Performance data / scoring against criteria: 25%\n"
            "  - Approval status / classification (approved, conditional, rejected): 15%\n"
            "  - Risk assessment of the supplier and controls applied: 15%\n"
            "  - Re-evaluation period and corrective actions for poor performers: 15%\n\n"
            "FAILURE CONDITIONS: no defined evaluation criteria; rating given without supporting "
            "data; no approval decision; no re-evaluation cycle defined.\n\n"
            "OPTIONAL FIELDS: certifications held by supplier (ISO 9001, etc.), audit history, "
            "alternative-supplier notes, escrow/contingency arrangements.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract each metric with its measured value and target. "
            "If a score is asserted without underlying data, mark the performance-data criterion "
            "as partial."
        ),
        "required_elements": [
            "Supplier identification and scope of products/services supplied",
            "Defined evaluation criteria (quality, delivery, price, compliance)",
            "Performance data scored against the criteria",
            "Approval status / classification decision",
            "Supplier risk assessment and controls applied",
            "Re-evaluation period and actions for under-performing suppliers",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_risk_assessment": {
        "name_ar": "تقرير تقييم المخاطر",
        "name_en": "Risk Assessment Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 6.1 (Actions to address risks and opportunities). Use only "
            "documented evidence.\n\n"
            "PURPOSE: Show that risks and opportunities affecting the QMS and its objectives are "
            "identified, analyzed, prioritized, and treated with planned actions.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Scope/context and process(es) covered: 10%\n"
            "  - Risk identification (hazards, threats, opportunities): 20%\n"
            "  - Risk analysis method (likelihood x severity / risk rating): 20%\n"
            "  - Risk evaluation and prioritization against acceptance criteria: 15%\n"
            "  - Treatment / mitigation actions with owners: 20%\n"
            "  - Residual risk and monitoring/review plan: 15%\n\n"
            "FAILURE CONDITIONS: no risk-rating methodology; risks listed without analysis; no "
            "mitigation actions or owners; no review/monitoring plan.\n\n"
            "OPTIONAL FIELDS: opportunities register, risk-appetite statement, link to objectives, "
            "trigger thresholds, contingency plans.\n\n"
            "EVIDENCE EXTRACTION RULES: For each risk extract its likelihood, severity, and "
            "resulting rating. Confirm the rating method is stated; if ratings appear without a "
            "defined scale, mark the analysis-method criterion as partial."
        ),
        "required_elements": [
            "Scope/context and processes covered",
            "Identified risks and opportunities",
            "Risk analysis method with likelihood and severity",
            "Risk evaluation and prioritization against acceptance criteria",
            "Treatment/mitigation actions with assigned owners",
            "Residual risk and monitoring/review plan",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_customer_complaint": {
        "name_ar": "تقرير شكوى العميل",
        "name_en": "Customer Complaint Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 9.1.2 (Customer satisfaction) and Clause 8.2.1 (Customer "
            "communication). Use only documented evidence.\n\n"
            "PURPOSE: Record a customer complaint and demonstrate timely handling, resolution, "
            "and feedback into improvement.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Complaint identification (ID, date received, customer, channel): 15%\n"
            "  - Clear description of the complaint and affected product/service: 20%\n"
            "  - Acknowledgement and response timeliness: 15%\n"
            "  - Investigation / root-cause where applicable: 20%\n"
            "  - Resolution / action taken and customer communication: 20%\n"
            "  - Closure status and customer satisfaction confirmation: 10%\n\n"
            "FAILURE CONDITIONS: complaint not uniquely logged; no resolution recorded; no "
            "communication back to the customer; complaint left open without status.\n\n"
            "OPTIONAL FIELDS: compensation/goodwill, severity rating, link to NCR/CAPA, trend "
            "analysis reference.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract dates received, responded, and closed to assess "
            "timeliness. If resolution is described but customer communication is absent, mark "
            "that criterion as partial."
        ),
        "required_elements": [
            "Complaint identifier, date received, customer, and channel",
            "Description of the complaint and affected product/service",
            "Acknowledgement and response timeliness",
            "Investigation or root-cause analysis where applicable",
            "Resolution/action taken and communication back to the customer",
            "Closure status and customer satisfaction confirmation",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_training_record": {
        "name_ar": "تقرير سجل التدريب",
        "name_en": "Training Record Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 7.2 (Competence) and Clause 7.3 (Awareness). Use only documented "
            "evidence.\n\n"
            "PURPOSE: Provide evidence that personnel are competent based on appropriate "
            "education, training, or experience, and that training effectiveness is evaluated.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Trainee identification and role/competence requirement: 15%\n"
            "  - Training topic/course and objectives: 15%\n"
            "  - Trainer/provider and date(s): 15%\n"
            "  - Attendance / completion evidence: 20%\n"
            "  - Evaluation of training effectiveness (test, assessment, on-job): 25%\n"
            "  - Competence/certification outcome and validity period: 10%\n\n"
            "FAILURE CONDITIONS: no link between training and a required competence; no "
            "attendance/completion evidence; no effectiveness evaluation recorded.\n\n"
            "OPTIONAL FIELDS: training cost, CEU/credits, re-training schedule, feedback scores.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract the competence requirement and confirm the "
            "training maps to it. If completion is recorded but effectiveness is not evaluated, "
            "mark the effectiveness criterion as non-compliant."
        ),
        "required_elements": [
            "Trainee identification and required competence/role",
            "Training topic/course and objectives",
            "Trainer/provider and training date(s)",
            "Attendance or completion evidence",
            "Evaluation of training effectiveness",
            "Resulting competence/certification and validity period",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_calibration": {
        "name_ar": "تقرير المعايرة",
        "name_en": "Calibration Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 7.1.5 (Monitoring and measuring resources, including measurement "
            "traceability). Use only documented evidence.\n\n"
            "PURPOSE: Confirm that measuring equipment is calibrated/verified against traceable "
            "standards, is fit for use, and its status is identifiable.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Equipment identification (ID, type, serial, location): 15%\n"
            "  - Calibration standard used and traceability to national/international standards: 20%\n"
            "  - Calibration method/procedure and environmental conditions: 10%\n"
            "  - Measurement results vs acceptance tolerances: 25%\n"
            "  - Pass/fail determination and calibration status label: 15%\n"
            "  - Calibration date, due date, and authorized signatory: 15%\n\n"
            "FAILURE CONDITIONS: no traceability to a recognized standard; results without "
            "tolerances; no pass/fail decision; no next-due date.\n\n"
            "OPTIONAL FIELDS: measurement uncertainty, as-found/as-left data, adjustment notes, "
            "out-of-tolerance impact assessment.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract each measured value with its tolerance and "
            "compare. If uncertainty or traceability chain is missing, mark the traceability "
            "criterion as partial."
        ),
        "required_elements": [
            "Equipment identification (ID, type, serial, location)",
            "Calibration standard used with traceability to recognized standards",
            "Calibration method/procedure and conditions",
            "Measurement results compared against acceptance tolerances",
            "Pass/fail determination and calibration status label",
            "Calibration date, due date, and authorized signatory",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_management_review": {
        "name_ar": "تقرير المراجعة الإدارية",
        "name_en": "Management Review Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 9.3 (Management review). Use only documented evidence.\n\n"
            "PURPOSE: Evidence that top management reviewed the QMS for continuing suitability, "
            "adequacy, effectiveness, and alignment with strategic direction.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Review meeting details (date, attendees incl. top management): 10%\n"
            "  - Status of actions from previous reviews: 10%\n"
            "  - Required INPUTS covered (audit results, customer feedback, process "
            "performance, NC/CA status, monitoring, supplier performance, risks/opportunities, "
            "resources): 30%\n"
            "  - Performance against quality objectives/KPIs: 15%\n"
            "  - Required OUTPUTS (improvement decisions, QMS change needs, resource needs): 25%\n"
            "  - Assigned actions with owners and due dates: 10%\n\n"
            "FAILURE CONDITIONS: top management not evidenced as present; one or more mandatory "
            "inputs missing; no decisions/outputs; no assigned actions.\n\n"
            "OPTIONAL FIELDS: strategic-context discussion, benchmarking, stakeholder feedback "
            "beyond customers.\n\n"
            "EVIDENCE EXTRACTION RULES: Checklist each required input/output (Clause 9.3.2 and "
            "9.3.3); mark any not explicitly evidenced as NOT FOUND. Do not assume an input was "
            "covered because the meeting occurred."
        ),
        "required_elements": [
            "Meeting date and attendees including top management",
            "Status of actions from previous management reviews",
            "All required review inputs (audit results, customer feedback, process performance, NC/CA status, monitoring results, supplier performance, risks/opportunities, resource adequacy)",
            "Performance against quality objectives/KPIs",
            "Review outputs (improvement decisions, QMS change needs, resource needs)",
            "Assigned actions with owners and due dates",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_document_control": {
        "name_ar": "تقرير ضبط الوثائق",
        "name_en": "Document Control Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 7.5 (Documented information — creation, update, and control). Use "
            "only documented evidence.\n\n"
            "PURPOSE: Demonstrate that documented information is identified, approved, version-"
            "controlled, distributed, protected, and that obsolete documents are controlled.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Document identification (title, unique ID, version/revision): 15%\n"
            "  - Approval/authorization before issue: 20%\n"
            "  - Revision history / change control: 20%\n"
            "  - Distribution and access control: 15%\n"
            "  - Control of obsolete documents and retention/disposal: 15%\n"
            "  - Review status and next review date: 15%\n\n"
            "FAILURE CONDITIONS: documents without version/revision; no approval evidence; no "
            "change history; obsolete documents not controlled.\n\n"
            "OPTIONAL FIELDS: document owner, storage medium, language/translation control, "
            "external-document register.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract version numbers, approval signatures/dates, and "
            "revision entries. If approval is implied but no signatory/date is shown, mark the "
            "approval criterion as partial."
        ),
        "required_elements": [
            "Document identification (title, unique ID, version/revision)",
            "Approval/authorization before issue",
            "Revision history and change control",
            "Distribution and access control",
            "Control of obsolete documents and retention/disposal",
            "Review status and next review date",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_kpi": {
        "name_ar": "تقرير مؤشرات الأداء",
        "name_en": "KPI Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 9.1.1 (Monitoring, measurement, analysis, evaluation) and Clause 6.2 "
            "(Quality objectives). Use only documented evidence.\n\n"
            "PURPOSE: Show that quality objectives are measured via KPIs, results are analyzed, "
            "and actions are taken when targets are not met.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - KPI definitions linked to quality objectives: 15%\n"
            "  - Measurement method, formula, and data source: 15%\n"
            "  - Target/threshold for each KPI: 15%\n"
            "  - Actual results for the period: 20%\n"
            "  - Analysis of trends and gaps vs target: 20%\n"
            "  - Actions for KPIs not meeting target with owners: 15%\n\n"
            "FAILURE CONDITIONS: KPIs without targets; results reported without analysis; no "
            "action where targets are missed; no link to objectives.\n\n"
            "OPTIONAL FIELDS: data-quality notes, benchmarking, forecast, visualization/charts.\n\n"
            "EVIDENCE EXTRACTION RULES: Extract each KPI's target and actual and compute the "
            "gap. If a KPI misses target but no action is recorded, mark the action criterion as "
            "non-compliant for that KPI."
        ),
        "required_elements": [
            "KPI definitions linked to quality objectives",
            "Measurement method, formula, and data source",
            "Target/threshold for each KPI",
            "Actual results for the reporting period",
            "Analysis of trends and gaps versus target",
            "Actions for KPIs not meeting target with assigned owners",
        ],
        "allowed_roles": ["iso-9001"],
    },
    "iso_preventive_maintenance": {
        "name_ar": "تقرير الصيانة الوقائية",
        "name_en": "Preventive Maintenance Report",
        "description": (
            "PERSONA: Act as a senior ISO 9001:2015 lead auditor. Evaluate the uploaded PDF "
            "against Clause 7.1.3 (Infrastructure). Use only documented evidence.\n\n"
            "PURPOSE: Demonstrate that infrastructure and equipment are maintained on a planned "
            "preventive schedule to ensure conforming products/services.\n\n"
            "WEIGHTED COMPLIANCE CRITERIA (total 100%):\n"
            "  - Asset/equipment identification and location: 15%\n"
            "  - Maintenance plan/schedule and frequency: 20%\n"
            "  - Maintenance tasks performed vs planned: 20%\n"
            "  - Date performed, technician, and next-due date: 15%\n"
            "  - Findings, parts replaced, and equipment status after maintenance: 15%\n"
            "  - Follow-up actions for defects found / unplanned breakdowns: 15%\n\n"
            "FAILURE CONDITIONS: no maintenance schedule; tasks performed not traceable to a "
            "plan; no next-due date; defects found with no follow-up.\n\n"
            "OPTIONAL FIELDS: downtime, cost, spare-parts inventory, predictive-maintenance "
            "data, warranty references.\n\n"
            "EVIDENCE EXTRACTION RULES: Compare planned vs performed tasks and extract performed "
            "and next-due dates. If breakdowns are recorded without corrective follow-up, mark "
            "the follow-up criterion as non-compliant."
        ),
        "required_elements": [
            "Asset/equipment identification and location",
            "Maintenance plan/schedule and frequency",
            "Maintenance tasks performed compared against the plan",
            "Date performed, technician, and next-due date",
            "Findings, parts replaced, and post-maintenance equipment status",
            "Follow-up actions for defects or unplanned breakdowns",
        ],
        "allowed_roles": ["iso-9001"],
    },
}


def get_report_type_context(report_type_key: str) -> str:
    """Build a comprehensive prompt context string for the given report type."""
    rt = REPORT_TYPES.get(report_type_key)
    if not rt:
        return ""

    elements = "\n".join(f"  {i+1}. {e}" for i, e in enumerate(rt["required_elements"]))
    cross_val = rt.get("cross_validation", "")

    # Determine document category for specific instructions
    is_specification = report_type_key in ("course_specification", "program_specification")
    is_report = report_type_key in ("course_report", "program_report")

    language_note = (
        "\nLANGUAGE NOTE: This document type is accepted in BOTH Arabic (العربية) and English. "
        "Evaluate content compliance regardless of language. Do NOT penalize for language choice."
    )

    category_instruction = ""
    if is_specification:
        category_instruction = (
            "\nDOCUMENT CATEGORY: SPECIFICATION (توصيف) — This is a PLANNING document. "
            "It describes what is PLANNED for the course/program. "
            "Evaluate completeness of planning elements, internal consistency, "
            "and alignment with accreditation standards. "
            "Check that all CLOs/POs are measurable and verifiable."
        )
    elif is_report:
        category_instruction = (
            "\nDOCUMENT CATEGORY: REPORT (تقرير) — This is a PERFORMANCE document. "
            "It describes what ACTUALLY HAPPENED. "
            "Evaluate presence of actual data (numbers, percentages, statistics), "
            "completeness of reflection sections, and quality of improvement plans. "
            "Vague statements like 'we will try to improve' are NOT acceptable — "
            "improvements must be specific, measurable, and time-bound."
        )

    return (
        f"\n\n{'='*60}\n"
        f"DOCUMENT TYPE VALIDATION\n"
        f"{'='*60}\n"
        f"Type (Arabic): {rt['name_ar']}\n"
        f"Type (English): {rt['name_en']}\n"
        f"{language_note}"
        f"{category_instruction}\n\n"
        f"DESCRIPTION:\n{rt['description']}\n\n"
        f"REQUIRED ELEMENTS — ALL must be present and filled:\n{elements}\n\n"
        f"EVALUATION INSTRUCTIONS:\n"
        f"  - Check each required element individually.\n"
        f"  - Mark as COMPLIANT if the element is PRESENT and contains actual content (not blank/placeholder).\n"
        f"  - Mark as NON-COMPLIANT ONLY if the element is completely absent or entirely empty.\n"
        f"  - Do NOT penalize for internal inconsistencies, arithmetic mismatches, or cross-reference errors.\n"
        f"  - Do NOT run self-consistency checks between sections.\n"
        f"  - Arabic text is fully acceptable — evaluate content, not language.\n"
        f"{'='*60}"
    )


# ---------------------------------------------------------------------------
# PDF Formatting Compliance Prompt — Egyptian University Accreditation Standards
# ---------------------------------------------------------------------------

REPORT_FORMAT_STRUCTURES: dict = {
    "course_report": [
        "Basic Information (course code, name, credit hours, instructor, semester)",
        "Data and Statistics (enrollment, pass/fail rates, grade distribution table)",
        "Student Feedback / تقييم الطلاب للمقرر (content, teaching, resources, exams evaluation)",
        "Instructors Reflection / تقييم القائمين على التدريس",
        "Course Enhancement / تطوير المقرر (comment on last year uncompleted actions)",
        "Course Development Plan for Next Academic Year",
    ],
    "program_report": [
        "Basic Information (program name, degree, duration, credit hours, academic year)",
        "Data and Statistics (enrollment, graduation, overall pass rates)",
        "Program Quality Assessment with KPI Table (targets vs actual)",
        "Commentary on KPIs Not Achieving Targets",
        "Stakeholder Evaluation (students, faculty, graduates, employers surveys)",
        "Comment on Overall Program Quality and Recommendations",
        "Program Enhancement (incomplete actions from last year)",
        "Comment on Course Reports Improvement Points",
        "Program Action Plan for Next Academic Year",
    ],
    "course_specification": [
        "Basic Information (course code, name, credit hours, prerequisites, level)",
        "Course Overview / الوصف العام للمقرر (scientific content summary)",
        "Course Learning Outcomes CLOs (knowledge K, skills S, values/competencies)",
        "CLO-PO Alignment Matrix (NARS/ARS mapping)",
        "Teaching and Learning Methods",
        "Course Schedule (weekly topic breakdown)",
        "Student Assessment Methods (with percentage weights summing to 100%)",
        "Learning Resources and Supportive Facilities",
    ],
    "program_specification": [
        "Basic Information (program name, degree, duration, total credit hours, council approval)",
        "Program Aims (graduate profile and overall purpose)",
        "Program Structure and Components (credit hour breakdown by category)",
        "Complete Course List by Study Plan (all years/semesters)",
        "Adopted Academic Standards NARS/ARS (with approval date and resolution number)",
        "Program Outcomes POs to Courses Mapping Matrix",
        "Teaching and Learning Strategies",
        "Student Assessment Strategies (for PO verification)",
        "Program Key Performance Indicators KPIs",
    ],
    "self_study": [
        "Cover Page", "Institutional Overview", "Vision, Mission, Strategic Goals",
        "Governance", "Academic Standards", "Teaching & Learning",
        "Research Activities", "Community Service", "Students & Graduates",
        "Quality Assurance System", "SWOT Analysis", "Evidence & Appendices",
        "Improvement Plan", "Final Conclusions", "Official Approvals",
    ],
    "execution_plan_followup": [
        "Strategic Objective", "Planned Activity", "Responsible Party",
        "Timeline", "Completion Percentage", "KPI Achievement",
        "Obstacles", "Corrective Actions", "Evidence",
    ],
    "survey_analysis": [
        "Survey Objective", "Methodology", "Target Audience", "Sample Size",
        "Statistical Results", "Charts and Graphs", "Analysis",
        "Recommendations", "Action Plan",
    ],
    "exam_results_analysis": [
        "Student Statistics", "Grade Distribution", "Pass/Fail Rates",
        "Comparison with Previous Years", "Difficulty Indicators",
        "Observations", "Recommendations",
    ],
    "reviewer_reports": [
        "Reviewer Information", "Scope of Review", "Strengths",
        "Weaknesses", "Recommendations", "Final Judgment",
    ],
    "financial_reports": [
        "Financial Summary", "Revenue Sources", "Expenditure Breakdown",
        "Budget Comparison", "Three-Year Financial Analysis",
        "Sustainability Indicators", "Conclusions",
    ],
    "field_training_reports": [
        "Training Objectives", "Training Locations", "Student Distribution",
        "Supervisor Evaluations", "Student Achievements",
        "Employer Feedback", "Challenges", "Recommendations",
    ],
    "student_activities": [
        "Activities Overview", "Participation Statistics", "Competitions",
        "Awards", "Community Activities", "Evidence Photos", "Impact Analysis",
    ],
    "hr_performance": [
        "Evaluation Criteria", "KPI Results", "Performance Analysis",
        "Strengths", "Weaknesses", "Development Plan",
    ],
    "training_plans_execution": [
        "Training Plan", "Implemented Courses", "Attendance Statistics",
        "Evaluation Results", "Training Impact", "Recommendations",
    ],
    "qa_unit_annual": [
        "Unit Activities", "Meetings", "Accreditation Activities",
        "Monitoring Activities", "Self-Evaluation Results",
        "Database Updates", "Recommendations",
    ],
    "student_data_reports": [
        "Enrollment Statistics", "Transfer Rates", "International Students",
        "Trend Analysis", "Comparative Tables", "Conclusions",
    ],
    "research_activity": [
        "Research Statistics", "Published Papers", "Conferences",
        "Funded Projects", "International Collaboration",
        "Research Impact Indicators",
    ],
    "research_ethics": [
        "Committee Activities", "Approved Research", "Violations",
        "Ethics Monitoring", "Recommendations",
    ],
    "physical_resources": [
        "Facility Description", "Evaluation Criteria", "Infrastructure Status",
        "Maintenance Needs", "Safety Evaluation", "Recommendations",
    ],
    "community_engagement": [
        "Community Activities", "Partnerships", "Consultations",
        "Environmental Activities", "Impact Assessment", "Recommendations",
    ],
}


def get_pdf_formatting_prompt(report_type_key: str = "") -> str:
    """
    Returns a prompt section instructing the AI to evaluate the uploaded PDF
    against Egyptian university accreditation formatting standards.
    Optionally includes the expected section structure for the given report type.
    """
    specific_structure = ""
    if report_type_key and report_type_key in REPORT_FORMAT_STRUCTURES:
        sections = "\n".join(
            f"  {i+1}. {s}"
            for i, s in enumerate(REPORT_FORMAT_STRUCTURES[report_type_key])
        )
        rt = REPORT_TYPES.get(report_type_key, {})
        specific_structure = (
            f"\n\nEXPECTED SECTION STRUCTURE for '{rt.get('name_en', report_type_key)}':\n"
            f"{sections}\n"
            f"Check whether the document follows this exact structure. "
            f"List any missing or misplaced sections."
        )

    return f"""

=== PDF DOCUMENT FORMATTING COMPLIANCE EVALUATION ===

You must evaluate the uploaded PDF against formal Egyptian university accreditation
and quality assurance documentation standards. Evaluate BOTH dimensions independently:

DIMENSION 1 — CONTENT COMPLIANCE (already covered above via quality standards).

DIMENSION 2 — DOCUMENT FORMATTING COMPLIANCE:
Evaluate each of the following formatting elements and note what is present or missing:

COVER PAGE — Check for:
  - University name, Faculty name, Department name
  - Quality Assurance Unit logo or identity
  - Report title, Academic year, Semester (if applicable)
  - Date of issue, Prepared by, Reviewed by, Approved by

TABLE OF CONTENTS — Check for:
  - Existence of table of contents
  - Correct page numbering
  - Logically organized sections

INTRODUCTION — Check for:
  - Purpose of report, Scope, Methodology, Reporting period

MAIN BODY STRUCTURE — Check for:
  - Clear headings, Numbered sections, Organized subsections
  - Labeled tables, Labeled figures, Readable charts
  - Professionally formatted statistical tables

CONCLUSION SECTION — Check for:
  - Summary of findings, Conclusions, Improvement priorities

RECOMMENDATIONS SECTION — Check for:
  - Actionable recommendations
  - Measurable recommendations
  - Timeline and responsibility assignments

APPENDICES — Check whether appendices exist when necessary:
  - Survey forms, Statistical tables, Attendance sheets
  - Official decisions, Reviewer reports, Evidence documents

SIGNATURES & APPROVALS — Check for:
  - Signatures, Stamps, Approval evidence
  - Council approvals, Committee approvals
  - If missing: classify as documentation weakness

LANGUAGE QUALITY — Evaluate:
  - Professionalism, Clarity, Academic writing quality
  - Grammar consistency, Terminology consistency
  - If weak or informal: flag clearly

VISUAL & DOCUMENT ORGANIZATION — Evaluate:
  - Font consistency, Spacing, Margins, Alignment
  - Readability, Page numbering, Section separation
{specific_structure}

=== FORMATTING COMPLIANCE SCORING ===

Add a "formatting_compliance" object to your JSON response with this structure:
{{
  "formatting_score": <number 0-100>,
  "cover_page": {{"present": true/false, "missing_items": ["..."]}},
  "table_of_contents": {{"present": true/false, "issues": "..."}},
  "introduction": {{"present": true/false, "issues": "..."}},
  "main_body": {{"well_structured": true/false, "issues": "..."}},
  "conclusion": {{"present": true/false, "issues": "..."}},
  "recommendations": {{"present": true/false, "actionable": true/false, "issues": "..."}},
  "appendices": {{"present": true/false, "issues": "..."}},
  "signatures_approvals": {{"present": true/false, "weakness": "..."}},
  "language_quality": {{"score": <0-100>, "issues": "..."}},
  "visual_organization": {{"score": <0-100>, "issues": "..."}},
  "missing_sections": ["..."],
  "formatting_strengths": ["..."],
  "formatting_weaknesses": ["..."]
}}

IMPORTANT FINAL RULE:
A document may have good content but poor formatting.
A document may have good formatting but weak evidence.
Evaluate BOTH independently and explain weaknesses in each dimension clearly.
====================================================="""


# ---------------------------------------------------------------------------
# Learned Model Patterns — injected from Quality Manager training
# ---------------------------------------------------------------------------

async def get_learned_patterns(db=None) -> str:
    """
    Retrieve patterns learned from the Quality Manager's training datasets.
    Returns formatted text to be injected into the AI analysis prompt.
    """
    if db is None:
        return ""
    try:
        state = await db[AI_MODEL_STATE_COLLECTION].find_one({}, sort=[("created_at", -1)])
        if state and state.get("patterns"):
            patterns_text = "\n".join(f"- {p}" for p in state["patterns"])
            version = state.get("version", "?")
            return (
                f"\n\n=== TRAINED QUALITY MODEL (v{version}) — LEARNED PATTERNS ===\n"
                f"The Quality Manager has trained the model. Apply these learned quality patterns "  
                f"FIRST before the standards rules below:\n{patterns_text}\n"
                f"=================================================================="
            )
    except Exception as e:
        print(f"Could not load learned patterns: {e}")
    return ""


# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

def _get_gemini_model(model_name: Optional[str] = None):
    """Configure and return a Gemini GenerativeModel instance."""
    try:
        from app.services.gemini_service import genai
        
        return genai.GenerativeModel(model_name or settings.GEMINI_MODEL)
    except ImportError:
        raise RuntimeError("google-generativeai not installed. Run: pip install google-generativeai")


def _is_gemini_configured() -> bool:
    """Check if Gemini API key is configured."""
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())


# ---------------------------------------------------------------------------
# Web Search (DuckDuckGo - free, no API key needed)
# ---------------------------------------------------------------------------

async def web_search(query: str, max_results: int = 5) -> list:
    """Perform a web search using DuckDuckGo (free, no API key needed)."""
    try:
        import warnings
        warnings.filterwarnings("ignore", category=RuntimeWarning)
        from duckduckgo_search import DDGS

        def _search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, _search)
        return [
            {"title": r.get("title", ""), "body": r.get("body", ""), "url": r.get("href", "")}
            for r in results
        ]
    except Exception as e:
        print(f"Web search error: {e}")
        return []


# ---------------------------------------------------------------------------
# Offline fallback analysis
# ---------------------------------------------------------------------------

def _offline_analyze_task(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    file_texts: Optional[List[dict]] = None,
) -> dict:
    """Offline rule-based task analysis when Gemini is unavailable."""
    passed = []
    failed = []
    suggestions = []
    desc_lower = (task_description or "").lower()
    title_lower = (task_title or "").lower()
    combined = f"{title_lower} {desc_lower}"

    for rule in standards_rules:
        if not rule.get("is_active", True):
            continue
        rule_text = rule.get("rule", "")
        rule_lower = rule_text.lower()
        category = rule.get("category", "general")

        # Simple keyword matching heuristic
        rule_passed = False

        if category == "text":
            # Check if description exists and has reasonable length
            if len(task_description or "") > 20:
                rule_passed = True
            else:
                suggestions.append(f"Add more detail to the task description for rule: {rule_text}")
        elif category == "image":
            # Can't verify images offline
            rule_passed = False
            suggestions.append(f"Image verification required for: {rule_text} (needs online AI)")
        elif category == "file":
            # Check if files were provided
            if file_texts and len(file_texts) > 0:
                rule_passed = True
            else:
                suggestions.append(f"Attach relevant files for: {rule_text}")
        else:
            # General rules - check if key terms from rule exist in description
            keywords = [w for w in rule_lower.split() if len(w) > 3]
            if keywords:
                matches = sum(1 for kw in keywords if kw in combined)
                rule_passed = matches >= len(keywords) * 0.3
            else:
                rule_passed = len(desc_lower) > 10

        if rule_passed:
            passed.append({"rule": rule_text, "result": "Passed (offline check)"})
        else:
            failed.append({"rule": rule_text, "reason": "Could not verify (offline mode)"})

    total = len(passed) + len(failed)
    score = (len(passed) / total * 100) if total > 0 else 50.0

    if not suggestions:
        suggestions.append("For more accurate analysis, ensure GEMINI_API_KEY is configured")
        suggestions.append("Review failed standards manually and update task accordingly")

    return {
        "compliance_score": round(score, 1),
        "passed_standards": passed,
        "failed_standards": failed,
        "suggestions": suggestions,
        "files_analyzed": [{"file_name": ft["file_name"], "file_type": ft.get("file_type", "text")} for ft in (file_texts or [])],
        "_raw": "offline_analysis",
        "_mode": "offline",
    }


def _offline_analyze_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
) -> dict:
    """Offline roadmap analysis with basic heuristics."""
    issues = []
    suggested_tasks = []
    improvements = []
    best_practices = []

    tasks_lower = [t.lower() for t in tasks_list]
    all_tasks_text = " ".join(tasks_lower)

    # Check for common missing phases
    if not any("test" in t for t in tasks_lower):
        issues.append("No testing tasks detected in the project workflow")
        suggested_tasks.append("Add unit testing and integration testing tasks")
    if not any("doc" in t for t in tasks_lower) and not any("readme" in t for t in tasks_lower):
        issues.append("No documentation tasks found")
        suggested_tasks.append("Add documentation and README creation tasks")
    if not any("deploy" in t for t in tasks_lower) and not any("release" in t for t in tasks_lower):
        suggested_tasks.append("Add deployment and release management tasks")
    if not any("review" in t for t in tasks_lower) and not any("code review" in t for t in tasks_lower):
        improvements.append("Implement code review process for all pull requests")
    if not any("security" in t or "auth" in t for t in tasks_lower):
        improvements.append("Consider adding security audit and vulnerability testing")
    if len(tasks_list) < 5:
        issues.append("Project has very few tasks - consider breaking down into smaller, manageable items")
    if not any("design" in t or "ui" in t or "ux" in t for t in tasks_lower):
        suggested_tasks.append("Add UI/UX design review tasks")

    best_practices = [
        "Follow agile methodology with regular sprint reviews",
        "Implement CI/CD pipeline for automated testing and deployment",
        "Use version control best practices (feature branches, pull requests)",
        "Document API endpoints and architecture decisions",
        "Perform regular code reviews and quality checks",
        "Set up monitoring and error tracking for production",
        "Create backup and disaster recovery procedures",
        "Follow security best practices (OWASP guidelines)",
    ]

    task_count = len(tasks_list)
    assessment = (
        f"Project '{project_title}' has {task_count} tasks. "
        f"{'The workflow appears well-structured.' if task_count >= 10 else 'Consider adding more granular tasks for better tracking.'} "
        f"(Offline analysis - connect to Gemini for detailed AI-powered insights)"
    )

    return {
        "issues_detected": issues,
        "suggested_tasks": suggested_tasks,
        "workflow_improvements": improvements,
        "best_practices": best_practices,
        "overall_assessment": assessment,
    }


def _offline_best_practices(project_type: str) -> List[str]:
    """Return generic best practices when offline."""
    base = [
        f"Define clear requirements and acceptance criteria for {project_type}",
        "Implement automated testing (unit, integration, e2e)",
        "Use version control with branching strategy (Git Flow or Trunk-based)",
        "Set up CI/CD pipeline for automated builds and deployments",
        "Conduct regular code reviews and pair programming sessions",
        "Document architecture decisions and API specifications",
        "Implement monitoring, logging, and alerting for production",
        "Follow security best practices and perform regular audits",
    ]
    return base


# ---------------------------------------------------------------------------
# Core task analysis
# ---------------------------------------------------------------------------

async def analyze_task_against_standards(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    image_bytes_list: Optional[List[bytes]] = None,
    file_texts: Optional[List[dict]] = None,
    db=None,
    report_type: Optional[str] = None,
) -> dict:
    """
    Send task content + quality standards to GPT-4o and return structured results.

    RAG path (preferred):
      - Embed the task → retrieve top-K relevant rules + patterns + report spec
      - Build a compact prompt (~60% fewer tokens)

    Full-dump fallback (when RAG unavailable):
      - Old behaviour: inject all rules + all patterns + full report spec

    Offline fallback (when Gemini unavailable):
      - Rule-based heuristic analysis
    """
    if not _is_gemini_configured():
        return _offline_analyze_task(task_title, task_description, standards_rules, file_texts)

    # -----------------------------------------------------------------------
    # Try RAG path first
    # -----------------------------------------------------------------------
    if db is not None:
        try:
            from app.services.rag_service import build_rag_context, rules_from_rag_chunks
            from app.services import rag_store as _rag_store_mod

            rag_ctx = await build_rag_context(task_title, task_description, report_type, db)

            if not rag_ctx.fallback_used:
                # Use RAG-retrieved context (compact prompt)
                rag_rules = rules_from_rag_chunks(
                    # Rebuild chunks from formatted text for the rules helper
                    [{"text": line.lstrip("- "), "metadata": {"rule_text": line.lstrip("- ").split("] ", 1)[-1], "rule_category": "general"}}
                     for line in rag_ctx.rules_text.splitlines() if line.strip().startswith("-")]
                ) if rag_ctx.rules_text else standards_rules

                try:
                    result = await _online_analyze_task(
                        task_title, task_description,
                        standards_rules=rag_rules if rag_rules else standards_rules,
                        image_bytes_list=image_bytes_list,
                        file_texts=file_texts,
                        learned_context=rag_ctx.patterns_text,
                        report_type_context=rag_ctx.report_spec_text,
                        report_type_key=report_type or "",
                    )
                    result["_rag_mode"] = "rag"
                    result["_rules_retrieved"] = rag_ctx.rules_retrieved
                    result["_patterns_retrieved"] = rag_ctx.patterns_retrieved
                    return result
                except Exception as e:
                    print(f"[RAG] Online analysis with RAG context failed: {e}")
        except Exception as e:
            print(f"[RAG] RAG path error, falling back to full-dump: {e}")

    # -----------------------------------------------------------------------
    # Full-dump fallback (original behaviour)
    # -----------------------------------------------------------------------
    learned_context = await get_learned_patterns(db)
    report_type_context = get_report_type_context(report_type) if report_type else ""

    try:
        result = await _online_analyze_task(
            task_title, task_description, standards_rules,
            image_bytes_list, file_texts, learned_context, report_type_context,
            report_type_key=report_type or "",
        )
        result["_rag_mode"] = "full_dump"
        return result
    except Exception as e:
        print(f"Gemini analysis failed, using offline fallback: {e}")

    return _offline_analyze_task(task_title, task_description, standards_rules, file_texts)


async def _online_analyze_task(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    image_bytes_list: Optional[List[bytes]] = None,
    file_texts: Optional[List[dict]] = None,
    learned_context: str = "",
    report_type_context: str = "",
    report_type_key: str = "",
) -> dict:
    """Online Gemini task analysis."""
    model = _get_gemini_model()

    # Build rules text
    rules_text = "\n".join(
        f"- [{r.get('category', 'general').upper()}] {r.get('rule', '')}"
        for r in standards_rules
        if r.get("is_active", True)
    )
    if not rules_text:
        rules_text = "No specific rules defined. Evaluate general quality."

    # Build file context
    # PDFs with raw_b64 are sent as Gemini inline_data for native understanding.
    # Extracted text is included in the prompt as supplementary context.
    file_context = ""
    files_analyzed = []
    pdf_inline_parts: List[dict] = []
    MAX_PDF_B64_LEN = 27_962_027  # ~20 MB decoded
    if file_texts:
        for ft in file_texts:
            fname = ft["file_name"]
            ftype = ft.get("file_type", "")
            raw_b64 = ft.get("raw_b64")
            if raw_b64 and len(raw_b64) <= MAX_PDF_B64_LEN:
                # Send PDF as Gemini native inline_data — Gemini reads the full file directly.
                # Do NOT also include extracted text: it's redundant and doubles the payload size.
                pdf_inline_parts.append({"inline_data": {"mime_type": "application/pdf", "data": raw_b64}})
                file_context += f"\n\nFile: {fname} (PDF attached as inline_data — analyse its full content natively)"
            elif raw_b64:
                file_context += f"\n\nFile: {fname} (PDF too large for inline analysis, using extracted text)"
                file_context += f"\n{ft.get('content', '[No text extracted]')}"
            else:
                file_context += f"\n\nFile: {fname}\nContent:\n{ft['content']}"
            files_analyzed.append({"file_name": fname, "file_type": ftype or "text"})

    # Build image parts for Gemini vision
    from app.services.gemini_service import genai
    content_parts: List[Any] = []

    has_pdf = any(
        ft.get("file_type", "").lower() == "pdf" or ft.get("file_name", "").lower().endswith(".pdf")
        for ft in (file_texts or [])
    )
    formatting_prompt = get_pdf_formatting_prompt(report_type_key) if has_pdf else ""

    extra_json_fields = ""
    if report_type_context:
        extra_json_fields += ',\n  "report_type_compliance": {"is_compliant": true/false, "missing_elements": ["..."], "compliance_note": "..."}'
    if has_pdf:
        extra_json_fields += ',\n  "formatting_compliance": {"formatting_score": 0-100, "cover_page": {...}, "table_of_contents": {...}, "introduction": {...}, "main_body": {...}, "conclusion": {...}, "recommendations": {...}, "appendices": {...}, "signatures_approvals": {...}, "language_quality": {...}, "visual_organization": {...}, "missing_sections": ["..."], "formatting_strengths": ["..."], "formatting_weaknesses": ["..."]}'

    prompt_text = f"""You are a strict Quality Assurance (QA) AI system متخصص في مراجعة الملفات والـ documents بشكل احترافي جداً.

Your job is to:
1) Extract the STANDARD SPECIFICATIONS from the reference/template.
2) Compare the uploaded file against these standards.
3) Give a precise evaluation score (0% → 100%).
4) Decide PASS or FAIL.
5) Provide detailed, structured feedback.
6) DO NOT accept imperfect submissions.

========================================
INPUTS:
========================================
- Reference Template (Official Format):
{rules_text}
- Submitted File (User Upload):
{file_context}

========================================
STEP 1: EXTRACT STANDARDS
========================================
From the reference template, extract ALL validation rules including:

1) Structure:
   - Required sections
   - Order of sections
   - Mandatory fields

2) Content:
   - Required data in each section
   - Academic/professional writing style
   - Language (English formal)

3) Formatting:
   - Headings
   - Tables
   - Alignment
   - Consistency

4) Data Quality:
   - منطقيه الأرقام
   - completeness
   - no missing fields

========================================
STEP 2: VALIDATION
========================================
Compare submitted file vs standards:

Check:
- Missing sections
- Wrong structure
- Incomplete fields
- Weak content
- Formatting issues
- Inconsistent data

========================================
STEP 3: SCORING SYSTEM
========================================
Calculate score based on:

- Structure (30%)
- Content Quality (30%)
- Completeness (20%)
- Formatting (10%)
- Accuracy & Logic (10%)

Return FINAL SCORE as percentage.

========================================
STEP 4: DECISION
========================================
- PASS → if score >= 70%
- FAIL → if score < 70%

========================================
STEP 5: ERROR REPORT (VERY IMPORTANT)
========================================
For EACH issue, provide:
- Error Type (e.g., Missing Section, Formatting Issue)
- Location (section name)
- Description (what is wrong exactly)
- Expected Fix (how to correct it)
Be VERY strict and detailed.

========================================
STEP 6: OUTPUT FORMAT
========================================
Return ONLY structured output in JSON format exactly like this:
{{
  "score": "87%",
  "status": "PASS / FAIL",
  "summary": "short explanation",
  "errors": [
    {{
      "type": "error type",
      "section": "section name",
      "issue": "what is wrong",
      "fix": "how to correct"
    }}
  ]
}}

========================================
STEP 7: AUTO-RESUBMISSION LOGIC
========================================
- If FAIL:
  → Clearly explain why rejected
  → Provide exact corrections
  → Make it easy to fix and resubmit

- If corrected version matches standards:
  → Immediately PASS without hesitation

========================================
STRICT RULES:
========================================
- Be harsh but fair
- No vague feedback
- No generic comments
- Every rejection must have clear reasons
- Think like ISO auditor / QA inspector

GOAL:
Build a fully automated document validation system with scoring and strict acceptance criteria.

Task Title: {task_title}
Task Description: {task_description or "(No description provided)"}
{learned_context}{report_type_context}{formatting_prompt}"""

    content_parts.append(prompt_text)

    # Attach PDFs as Gemini inline_data for native document understanding
    for pdf_part in pdf_inline_parts:
        content_parts.append(pdf_part)

    # Attach images for vision analysis
    if image_bytes_list:
        for img_bytes in image_bytes_list[:3]:
            content_parts.append({
                "mime_type": "image/jpeg",
                "data": base64.b64encode(img_bytes).decode("utf-8"),
            })

    response = await model.generate_content_async(
        content_parts,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=3072,  # was 8192 — trimmed to cut generation time ~60%
        ),
    )

    raw = response.text or ""
    result = _parse_json_safe(raw)

    # Map the user's requested JSON format to the system's expected format
    if "score" in result:
        # score could be "87%" or 87
        score_val = str(result["score"]).replace('%', '').strip()
        try:
            result["compliance_score"] = float(score_val)
        except ValueError:
            result["compliance_score"] = 0.0

    if "status" in result:
        status_val = str(result["status"]).upper()
        if "PASS" in status_val:
            result["verdict"] = "ACCEPTED"
        else:
            result["verdict"] = "NOT ACCEPTED"

    if "errors" in result and isinstance(result["errors"], list):
        result["failed_standards"] = []
        result["rejection_details"] = []
        for err in result["errors"]:
            issue_desc = err.get("issue", "")
            fix_desc = err.get("fix", "")
            err_type = err.get("type", "")
            section = err.get("section", "")
            result["failed_standards"].append({
                "rule": err_type,
                "reason": issue_desc,
                "location": section
            })
            result["rejection_details"].append({
                "issue": issue_desc,
                "reason": err_type,
                "location": section,
                "how_to_fix": fix_desc
            })

    if "summary" in result:
        result["suggestions"] = [result["summary"]]

    result.setdefault("compliance_score", 0.0)
    result.setdefault("passed_standards", [])
    result.setdefault("failed_standards", [])
    result.setdefault("suggestions", [])
    result.setdefault("files_analyzed", files_analyzed)
    result.setdefault("rejection_details", [])

    result["compliance_score"] = max(0.0, min(100.0, float(result["compliance_score"])))

    if "verdict" not in result:
        result["verdict"] = "ACCEPTED" if result["compliance_score"] >= 70 else "NOT ACCEPTED"

    result["_raw"] = raw
    result["_mode"] = "online"
    return result


# ---------------------------------------------------------------------------
# Roadmap / Workflow assistant
# ---------------------------------------------------------------------------

async def analyze_project_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
    standards_context: str = "",
    extra_context: str = "",
) -> dict:
    """
    Analyze the project workflow using AI and return improvement recommendations.
    Falls back to offline analysis if Gemini is unavailable.
    """
    if _is_gemini_configured():
        try:
            return await _online_analyze_roadmap(
                project_title, project_description, tasks_list,
                standards_context, extra_context,
            )
        except Exception as e:
            print(f"Gemini roadmap analysis failed, using offline fallback: {e}")

    return _offline_analyze_roadmap(project_title, project_description, tasks_list)


async def _online_analyze_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
    standards_context: str = "",
    extra_context: str = "",
) -> dict:
    """Online Gemini roadmap analysis with web search augmentation."""
    from app.services.gemini_service import genai
    model = _get_gemini_model()

    tasks_text = "\n".join(f"- {t}" for t in tasks_list) if tasks_list else "(No tasks listed)"

    # Web search for additional context
    search_context = ""
    try:
        search_results = await web_search(
            f"{project_title} {extra_context} project quality checklist best practices",
            max_results=3,
        )
        if search_results:
            search_context = "\n\nRelevant web search results:\n" + "\n".join(
                f"- [{r['title']}]({r['url']}): {r['body'][:200]}"
                for r in search_results
            )
    except Exception:
        pass

    prompt = f"""You are a senior software project management consultant and QA expert.
You analyze project workflows and suggest improvements based on industry best practices.
You must respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.

JSON format:
{{
  "issues_detected": ["<issue description>"],
  "suggested_tasks": ["<task that should be added>"],
  "workflow_improvements": ["<workflow change recommendation>"],
  "best_practices": ["<relevant best practice from industry standards>"],
  "overall_assessment": "<2-3 sentence summary of project quality>"
}}

Project Title: {project_title}
Project Description: {project_description or "(No description)"}

Current Tasks:
{tasks_text}

Quality Standards Context:
{standards_context or "(No specific QC standards defined)"}

Additional Context:
{extra_context or "(None)"}
{search_context}

Please analyze this project workflow:
1. Identify any missing critical tasks or phases
2. Detect workflow issues (e.g., no testing phase, no documentation tasks)
3. Suggest improvements based on modern development standards (Agile, DevOps, etc.)
4. Reference industry best practices
5. Provide a concise overall assessment"""

    response = await model.generate_content_async(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.4,
            max_output_tokens=1500,
        ),
    )

    raw = response.text or ""
    result = _parse_json_safe(raw)

    result.setdefault("issues_detected", [])
    result.setdefault("suggested_tasks", [])
    result.setdefault("workflow_improvements", [])
    result.setdefault("best_practices", [])
    result.setdefault("overall_assessment", "Analysis could not be completed.")
    return result


# ---------------------------------------------------------------------------
# QC Chat assistant
# ---------------------------------------------------------------------------

async def chat_with_analysis(
    task_title: str,
    task_description: str,
    analysis_summary: str,
    conversation: List[dict],
    user_message: str,
) -> str:
    """
    Answer follow-up questions about a QC analysis in a friendly chat format.
    Falls back to a simple offline reply if Gemini is unavailable.
    """
    if not _is_gemini_configured():
        return (
            "Gemini API key is not configured. "
            "I can see your task is about: " + task_title + ". "
            "Please configure GEMINI_API_KEY for full AI chat support."
        )
    try:
        return await _online_chat_with_analysis(
            task_title, task_description, analysis_summary, conversation, user_message
        )
    except Exception as e:
        return f"I encountered an error while processing your question: {e}"


async def _online_chat_with_analysis(
    task_title: str,
    task_description: str,
    analysis_summary: str,
    conversation: List[dict],
    user_message: str,
) -> str:
    from app.services.gemini_service import genai
    model = _get_gemini_model()

    system_context = f"""You are an expert Quality Control AI assistant helping a software team.
You analyzed the task "{task_title}" and produced a quality compliance report.

Task description: {task_description or "(not provided)"}

Previous analysis result:
{analysis_summary or "(no previous analysis yet)"}

Answer the user's questions about the analysis in a clear, concise, and helpful way.
Keep responses focused and practical. Use plain text without heavy markdown.
If the user asks to re-analyze or improve something, provide actionable guidance."""

    # Build conversation history for Gemini
    history = []
    for msg in conversation[-10:]:
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    chat = model.start_chat(history=history)
    full_message = f"{system_context}\n\nUser question: {user_message}"

    response = await chat.send_message_async(
        full_message,
        generation_config=genai.GenerationConfig(
            temperature=0.5,
            max_output_tokens=600,
        ),
    )

    return response.text or "I could not generate a response."


# ---------------------------------------------------------------------------
# Best practices (with web search augmentation)
# ---------------------------------------------------------------------------

async def get_best_practices_for_project(
    project_type: str,
    context: str = "",
) -> List[str]:
    """
    Ask GPT to provide relevant industry best practices, augmented with web search.
    Falls back to offline practices if Gemini is unavailable.
    """
    if _is_gemini_configured():
        try:
            return await _online_best_practices(project_type, context)
        except Exception as e:
            print(f"Gemini best practices failed, using offline fallback: {e}")

    return _offline_best_practices(project_type)


async def _online_best_practices(
    project_type: str,
    context: str = "",
) -> List[str]:
    """Online best practices with web search (Gemini)."""
    from app.services.gemini_service import genai
    model = _get_gemini_model()

    # Search the web for current best practices
    search_context = ""
    try:
        search_results = await web_search(
            f"best practices {project_type} project quality standards {datetime.now().year}",
            max_results=5,
        )
        if search_results:
            search_context = "\n\nRelevant web search results:\n" + "\n".join(
                f"- [{r['title']}]({r['url']}): {r['body'][:200]}"
                for r in search_results
            )
    except Exception:
        pass

    prompt = (
        f"You are a software engineering best practices expert. "
        f"Use the provided web search results as references when available. "
        f"Respond with a JSON array of strings ONLY — no explanation outside the array.\n\n"
        f"List 8 industry best practices for a {project_type} project. "
        f"Context: {context}. {search_context}\n\n"
        f'Respond as JSON array: ["practice 1", "practice 2", ...]'
    )

    response = await model.generate_content_async(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=600,
        ),
    )

    raw = response.text or "[]"
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    return [raw]


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _parse_json_safe(text: str) -> dict:
    """Extract and parse JSON from a string that may contain extra text."""
    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try extracting JSON block from markdown
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Try finding first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return {}
