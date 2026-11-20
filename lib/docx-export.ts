import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from "docx";
import { CPSAnalysisResult } from "@/types/cps";

// Helper for consistent section headings
function createSectionHeader(title: string): Paragraph {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: {
        color: "1E3A8A",
        space: 4,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
  });
}

function createSubHeader(title: string): Paragraph {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
}

function createBullet(title: string, text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `• ${title}: `, bold: true, color: "1E3A8A" }),
      new TextRun({ text: text || "-" }),
    ],
    spacing: { after: 80 },
  });
}

function createSimpleBullet(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "• ", bold: true, color: "1E3A8A" }),
      new TextRun({ text }),
    ],
    spacing: { after: 60 },
  });
}

export async function generateCPSDocx(data: CPSAnalysisResult): Promise<Blob> {
  const { org_info, management_4m, business_analysis, welfare_analysis, cps_summary_and_audit } = data;

  // Header Table for Key Financial Figures
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "ทุนดำเนินงาน", bold: true, color: "1E3A8A" })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: org_info.operating_capital, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "กำไร (ขาดทุน) สุทธิ", bold: true, color: "1E3A8A" })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: org_info.net_profit, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "จำนวนสมาชิก", bold: true, color: "1E3A8A" })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: org_info.total_members, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "ชั้นคุณภาพ RQ 2", bold: true, color: "1E3A8A" })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: org_info.internal_control_rq2, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
            ],
          }),
        ],
      }),
    ],
  });

  // Business Table Rows
  const businessRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ชื่อธุรกิจ", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ปริมาณธุรกิจ", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "กำไร/ขาดทุน", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "การมีส่วนร่วมของสมาชิก", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ความเสี่ยง/ข้อสังเกต", bold: true })] })] }),
      ],
    }),
    ...business_analysis.businesses.map(
      (b) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(b.business_name)] }),
            new TableCell({ children: [new Paragraph(b.volume || "-")] }),
            new TableCell({ children: [new Paragraph(b.profit_loss || "-")] }),
            new TableCell({ children: [new Paragraph(b.member_participation || "-")] }),
            new TableCell({ children: [new Paragraph(b.risks_and_observations || "-")] }),
          ],
        })
    ),
  ];

  const businessTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: businessRows,
  });

  // Welfare Fund Table Rows
  const welfareRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ชื่อกองทุน/ทุนสะสม", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ยอดยกมา", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "จัดสรรเพิ่ม", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "เบิกใช้จริง", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ยอดคงเหลือ", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "การใช้จริง", bold: true })] })] }),
      ],
    }),
    ...welfare_analysis.reserve_and_welfare_funds.map(
      (w) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(w.fund_name)] }),
            new TableCell({ children: [new Paragraph(w.beginning_balance || "-")] }),
            new TableCell({ children: [new Paragraph(w.added_amount || "-")] }),
            new TableCell({ children: [new Paragraph(w.disbursed_amount || "-")] }),
            new TableCell({ children: [new Paragraph(w.ending_balance || "-")] }),
            new TableCell({ children: [new Paragraph(w.is_utilized || "-")] }),
          ],
        })
    ),
  ];

  const welfareTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: welfareRows,
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "รายงานผลการวิเคราะห์ข้อมูลสหกรณ์และกลุ่มเกษตรกร (CPS Analysis Report)",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "หน่วยงาน: ", bold: true }),
              new TextRun("กลุ่มส่งเสริมและพัฒนาการบริหารการจัดการสหกรณ์"),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "สหกรณ์/กลุ่มเกษตรกร: ", bold: true }),
              new TextRun(`${org_info.coop_name} (${org_info.coop_type || "สหกรณ์"})`),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "ประจำปีบัญชีสิ้นสุด: ", bold: true }),
              new TextRun(org_info.fiscal_year_end),
              ...(org_info.cooperative_strength_class
                ? [
                    new TextRun({ text: "  |  ชั้นความเข้มแข็ง: ", bold: true, color: "1E3A8A" }),
                    new TextRun({ text: org_info.cooperative_strength_class, bold: true }),
                  ]
                : []),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Summary Cards Table
          summaryTable,

          new Paragraph({ text: "", spacing: { after: 200 } }),

          // Section 1: 4M
          createSectionHeader("1. ด้านการบริหารจัดการองค์กร (วิเคราะห์ตามหลัก 4M)"),
          createSubHeader("1.1 ด้านบุคลากร (Man)"),
          new Paragraph({ text: management_4m.man.summary, spacing: { after: 100 } }),
          createBullet("สถานะสมาชิกและการเข้าร่วมประชุม", management_4m.man.member_status),
          createBullet("คณะกรรมการดำเนินการ", management_4m.man.committee_status),
          createBullet("ฝ่ายจัดการและผู้ตรวจสอบกิจการ", management_4m.man.staff_and_auditor),
          createBullet("ผลการประเมินการควบคุมภายใน (RQ 2 ด้านคน)", management_4m.man.rq2_assessment),

          createSubHeader("1.2 ด้านการเงินและทุน (Money)"),
          new Paragraph({ text: management_4m.money.summary, spacing: { after: 100 } }),
          createBullet("ทุนดำเนินงานและโครงสร้างเงินทุน", management_4m.money.operating_capital),
          createBullet("สัดส่วนทุนตนเองต่อหนี้สิน", management_4m.money.equity_to_debt_ratio),
          createBullet("สภาพคล่องทางการเงิน", management_4m.money.liquidity),
          createBullet("สัดส่วนหนี้สินเฉลี่ยต่อเงินออมเฉลี่ย", management_4m.money.debt_to_savings),

          createSubHeader("1.3 ด้านทรัพย์สินและอุปกรณ์ (Material)"),
          new Paragraph({ text: management_4m.material.summary, spacing: { after: 100 } }),
          createBullet("ทรัพย์สินถาวร", management_4m.material.fixed_assets),
          createBullet("อุปกรณ์ ครุภัณฑ์ และคอมพิวเตอร์", management_4m.material.office_and_equipment),
          createBullet("การใช้ประโยชน์และความคุ้มค่า", management_4m.material.utilization_status),

          createSubHeader("1.4 ด้านการบริหารจัดการ (Management)"),
          new Paragraph({ text: management_4m.management.summary, spacing: { after: 100 } }),
          createBullet("การปฏิบัติตามกฎหมายและข้อบังคับ", management_4m.management.compliance),
          createBullet("การจัดทำบัญชีขั้นต้น-ขั้นปลาย", management_4m.management.accounting_status),
          createBullet("ระดับการพึ่งพาเจ้าหน้าที่รัฐ", management_4m.management.dependency_on_officials),
          createBullet("ประสิทธิภาพการตรวจสอบภายใน", management_4m.management.internal_audit),

          // Section 2: Business
          createSectionHeader("2. ด้านการบริหารจัดการธุรกิจ"),
          new Paragraph({ text: business_analysis.overview, spacing: { after: 140 } }),
          businessTable,
          new Paragraph({ text: "", spacing: { after: 120 } }),
          createSubHeader("ผลการตรวจสอบความสอดคล้องของตัวเลข (Cross-Check Notes)"),
          ...business_analysis.cross_check_notes.map((note) => createSimpleBullet(note)),

          // Section 3: Welfare
          createSectionHeader("3. ด้านการจัดสวัสดิการและสาธารณประโยชน์"),
          createSubHeader("3.1 ตารางทุนสะสมตามข้อบังคับและทุนสวัสดิการ (จากหมายเหตุประกอบงบการเงิน)"),
          welfareTable,
          new Paragraph({ text: "", spacing: { after: 120 } }),
          createSubHeader("3.2 สรุปการเบิกจ่ายสวัสดิการไปใช้จริง"),
          new Paragraph({ text: welfare_analysis.actual_usage_summary, spacing: { after: 140 } }),

          // Section 4: CPS Summary and Audit
          createSectionHeader("4. สรุปผลการวิเคราะห์และเป้าหมายการส่งเสริม (CPS)"),
          createSubHeader("4.1 สรุปภาพรวมการปฏิบัติงานของคณะกรรมการดำเนินการ (วิเคราะห์เชิงลึก)"),
          ...(typeof cps_summary_and_audit.board_performance_summary === "string"
            ? [new Paragraph({ text: cps_summary_and_audit.board_performance_summary, spacing: { after: 100 } })]
            : [
                new Paragraph({
                  children: [
                    new TextRun({ text: "• ภาพรวมและผลการประเมิน: ", bold: true, color: "1E3A8A" }),
                    new TextRun(cps_summary_and_audit.board_performance_summary.overall_evaluation || "-"),
                  ],
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "• สถิติการประชุมและการมีส่วนร่วม: ", bold: true, color: "1E3A8A" }),
                    new TextRun(cps_summary_and_audit.board_performance_summary.meeting_and_attendance || "-"),
                  ],
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "• การขับเคลื่อนมติที่ประชุมใหญ่ (สำเร็จ vs คั่งค้าง): ", bold: true, color: "1E3A8A" }),
                    new TextRun(cps_summary_and_audit.board_performance_summary.agm_resolutions_drive || "-"),
                  ],
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "• การกำกับดูแลฝ่ายจัดการและธุรกิจ: ", bold: true, color: "1E3A8A" }),
                    new TextRun(cps_summary_and_audit.board_performance_summary.management_and_business_control || "-"),
                  ],
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "• ธรรมาภิบาลและการแก้ไขข้อบกพร่อง: ", bold: true, color: "1E3A8A" }),
                    new TextRun(cps_summary_and_audit.board_performance_summary.governance_and_compliance || "-"),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  text: "ผลงานสำคัญที่คณะกรรมการผลักดันสำเร็จ:",
                  heading: HeadingLevel.HEADING_4,
                  spacing: { before: 80, after: 60 },
                }),
                ...(cps_summary_and_audit.board_performance_summary.key_achievements?.map((ach) =>
                  createSimpleBullet(ach)
                ) || []),
                new Paragraph({
                  text: "จุดอ่อน/ข้อบกพร่องที่คณะกรรมการต้องเร่งแก้ไข:",
                  heading: HeadingLevel.HEADING_4,
                  spacing: { before: 80, after: 60 },
                }),
                ...(cps_summary_and_audit.board_performance_summary.areas_for_improvement?.map((imp) =>
                  createSimpleBullet(imp)
                ) || []),
              ]),

          createSubHeader("4.2 จุดเด่นของสหกรณ์"),
          ...cps_summary_and_audit.strengths.map((s) => createSimpleBullet(s)),

          createSubHeader("4.3 จุดอ่อนและประเด็นที่ต้องปรับปรุง"),
          ...cps_summary_and_audit.weaknesses.map((w) => createSimpleBullet(w)),

          createSubHeader("4.4 เป้าหมายและแผนปฏิบัติการส่งเสริมปีงบประมาณถัดไป (CPS Goals & Action Plan)"),
          ...cps_summary_and_audit.promotion_goals_next_year.map((g) => {
            if (typeof g === "string") return createSimpleBullet(g);
            return createBullet(
              g.goal,
              `มาตรการส่งเสริม: ${g.action_plan}${g.target_kpi ? ` | ตัวชี้วัด/กรอบเวลา: ${g.target_kpi}` : ""}`
            );
          }),

          createSubHeader("4.5 ข้อสังเกตและข้อเสนอแนะของผู้สอบบัญชี (จำแนกตามระดับความเสี่ยง)"),
          ...cps_summary_and_audit.auditor_observations.map((obs) => {
            if (typeof obs === "string") return createSimpleBullet(obs);
            const severityLabel =
              obs.severity === "CRITICAL"
                ? "[วิกฤต/ข้อบกพร่องตามกฎหมาย]"
                : obs.severity === "WARNING"
                ? "[เตือนภัย/ความเสี่ยงสูง]"
                : "[ข้อเสนอแนะเชิงพัฒนา]";
            return createBullet(
              `${severityLabel} ${obs.issue}`,
              `${obs.impact ? `ผลกระทบ: ${obs.impact} | ` : ""}แนวทางแก้ไข: ${obs.recommendation || "-"}`
            );
          }),

          createSubHeader("4.6 บทสรุป CPS ฉบับสมบูรณ์ (สำหรับคัดลอกลงระบบ CPS)"),
          new Paragraph({
            text: cps_summary_and_audit.cps_full_summary_text,
            spacing: { before: 100, after: 100 },
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
