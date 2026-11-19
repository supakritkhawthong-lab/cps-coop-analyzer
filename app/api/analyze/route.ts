import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { CPSAnalysisResult } from "@/types/cps";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for processing large PDFs

// Standard JSON Schema for CPS analysis structured output
const cpsJsonSchema = {
  type: "object",
  properties: {
    org_info: {
      type: "object",
      properties: {
        coop_name: { type: "string", description: "ชื่อสหกรณ์หรือกลุ่มเกษตรกร" },
        coop_type: { type: "string", description: "ประเภทสหกรณ์ เช่น สหกรณ์การเกษตร, สหกรณ์ออมทรัพย์" },
        fiscal_year_end: { type: "string", description: "วันสิ้นสุดปีบัญชี เช่น 31 มีนาคม 2567" },
        operating_capital: { type: "string", description: "ทุนดำเนินงานทั้งสิ้น ระบุจำนวนเงินและหน่วย" },
        net_profit: { type: "string", description: "กำไรหรือขาดทุนสุทธิประจำปี" },
        total_members: { type: "string", description: "จำนวนสมาชิก ณ วันสิ้นปี" },
        internal_control_rq2: { type: "string", description: "ผลการจัดชั้นคุณภาพการควบคุมภายใน แบบ RQ 2" },
        key_financial_ratios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "ชื่ออัตราส่วน" },
              value: { type: "string", description: "ค่าของอัตราส่วน" },
              interpretation: { type: "string", description: "คำอธิบายหรือเกณฑ์มาตรฐาน" },
            },
            required: ["label", "value"],
          },
        },
      },
      required: [
        "coop_name",
        "coop_type",
        "fiscal_year_end",
        "operating_capital",
        "net_profit",
        "total_members",
        "internal_control_rq2",
        "key_financial_ratios",
      ],
    },
    management_4m: {
      type: "object",
      properties: {
        man: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปภาพรวมด้านบุคลากร Man" },
            member_status: { type: "string", description: "จำนวนสมาชิก เพิ่ม/ลด และการเข้าร่วมประชุมใหญ่" },
            committee_status: { type: "string", description: "คณะกรรมการดำเนินการ จำนวน วาระ การแบ่งหน้าที่" },
            staff_and_auditor: { type: "string", description: "การจัดจ้างเจ้าหน้าที่ประจำ และผู้ตรวจสอบกิจการ" },
            rq2_assessment: { type: "string", description: "ผลการประเมินการควบคุมภายในแบบ RQ2 มิติด้านคน" },
          },
          required: ["summary", "member_status", "committee_status", "staff_and_auditor", "rq2_assessment"],
        },
        money: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปภาพรวมด้านการเงิน Money" },
            operating_capital: { type: "string", description: "ทุนดำเนินงาน ทุนเรือนหุ้น ทุนสำรอง" },
            equity_to_debt_ratio: { type: "string", description: "สัดส่วนทุนตนเองต่อหนี้สิน" },
            liquidity: { type: "string", description: "สภาพคล่อง เงินสด/เงินฝากเทียบกับลูกหนี้" },
            debt_to_savings: { type: "string", description: "สัดส่วนหนี้สินเฉลี่ยต่อเงินออมเฉลี่ยของสมาชิก" },
          },
          required: ["summary", "operating_capital", "equity_to_debt_ratio", "liquidity", "debt_to_savings"],
        },
        material: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปภาพรวมด้านทรัพย์สิน Material" },
            fixed_assets: { type: "string", description: "ทรัพย์สินถาวร ที่ดิน อาคาร โกดัง ยานพาหนะ" },
            office_and_equipment: { type: "string", description: "อุปกรณ์ ครุภัณฑ์ และระบบสารสนเทศ/คอมพิวเตอร์" },
            utilization_status: { type: "string", description: "การใช้ประโยชน์และความคุ้มค่าของทรัพย์สิน" },
          },
          required: ["summary", "fixed_assets", "office_and_equipment", "utilization_status"],
        },
        management: {
          type: "object",
          properties: {
            summary: { type: "string", description: "สรุปภาพรวมด้านการบริหารจัดการ Management" },
            compliance: { type: "string", description: "การปฏิบัติตามกฎหมาย ระเบียบ และข้อบังคับ" },
            accounting_status: { type: "string", description: "การจัดทำบัญชีขั้นต้น-ขั้นปลาย ทำได้เองหรือจ้างทำ" },
            dependency_on_officials: { type: "string", description: "ระดับการพึ่งพาเจ้าหน้าที่ภาครัฐ" },
            internal_audit: { type: "string", description: "ประสิทธิภาพการตรวจสอบภายในและการกำกับดูแล" },
          },
          required: ["summary", "compliance", "accounting_status", "dependency_on_officials", "internal_audit"],
        },
      },
      required: ["man", "money", "material", "management"],
    },
    business_analysis: {
      type: "object",
      properties: {
        overview: { type: "string", description: "ภาพรวมการดำเนินธุรกิจทั้งหมดและจำนวนธุรกิจที่ทำจริง" },
        businesses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              business_name: { type: "string", description: "ชื่อธุรกิจ เช่น สินเชื่อ, จัดหาสินค้า, รับฝากเงิน" },
              volume: { type: "string", description: "ปริมาณธุรกิจเทียบเป้าหมาย" },
              profit_loss: { type: "string", description: "กำไรหรือขาดทุนเฉพาะธุรกิจ" },
              member_participation: { type: "string", description: "อัตราการมีส่วนร่วมของสมาชิก" },
              risks_and_observations: { type: "string", description: "ความเสี่ยงแฝง หนี้ค้าง สินค้าค้างสต็อก ฯลฯ" },
            },
            required: ["business_name", "volume", "profit_loss", "member_participation", "risks_and_observations"],
          },
        },
        cross_check_notes: {
          type: "array",
          items: { type: "string" },
          description: "ผลการตรวจทานตัวเลขข้ามเอกสาร ระหว่างรายงานการประชุมใหญ่กับงบการเงินและรายงานผู้สอบบัญชี",
        },
      },
      required: ["overview", "businesses", "cross_check_notes"],
    },
    welfare_analysis: {
      type: "object",
      properties: {
        profit_allocation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fund_name: { type: "string", description: "ชื่อกองทุน/รายการจัดสรรกำไร" },
              allocated_amount: { type: "string", description: "จำนวนเงินที่จัดสรร" },
              note: { type: "string", description: "หมายเหตุ" },
            },
            required: ["fund_name", "allocated_amount"],
          },
        },
        reserve_and_welfare_funds: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fund_name: { type: "string", description: "ชื่อทุนสะสมตามข้อบังคับ/ทุนสวัสดิการ" },
              beginning_balance: { type: "string", description: "ยอดยกมาต้นปี" },
              added_amount: { type: "string", description: "ยอดจัดสรรเพิ่มระหว่างปี" },
              disbursed_amount: { type: "string", description: "ยอดเบิกจ่ายไปใช้จริงระหว่างปี" },
              ending_balance: { type: "string", description: "ยอดคงเหลือสิ้นปี" },
              is_utilized: { type: "string", description: "สถานะการนำไปใช้จริง หรือเก็บสะสมไว้ไม่ใช้" },
            },
            required: ["fund_name", "beginning_balance", "added_amount", "disbursed_amount", "ending_balance", "is_utilized"],
          },
        },
        actual_usage_summary: {
          type: "string",
          description: "สรุปการเบิกจ่ายสวัสดิการไปใช้จริงเทียบกับการสะสมค้างในบัญชี",
        },
      },
      required: ["profit_allocation", "reserve_and_welfare_funds", "actual_usage_summary"],
    },
    cps_summary_and_audit: {
      type: "object",
      properties: {
        board_performance_summary: { type: "string", description: "สรุปภาพรวมการปฏิบัติงานของคณะกรรมการ" },
        promotion_goals_next_year: {
          type: "array",
          items: { type: "string" },
          description: "เป้าหมายในการส่งเสริมปีงบประมาณถัดไป (CPS Goals)"
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "จุดเด่นของสหกรณ์/กลุ่มเกษตรกร"
        },
        weaknesses: {
          type: "array",
          items: { type: "string" },
          description: "จุดอ่อนหรือข้อบกพร่องที่ต้องแก้ไข"
        },
        auditor_observations: {
          type: "array",
          items: { type: "string" },
          description: "ข้อสังเกตของผู้สอบบัญชี สตส. ครบทุกประเด็น"
        },
        cps_full_summary_text: {
          type: "string",
          description: "บทสรุป CPS ฉบับสมบูรณ์สำหรับคัดลอกลงระบบ CPS ของกรมส่งเสริมสหกรณ์ได้ทันที"
        },
      },
      required: [
        "board_performance_summary",
        "promotion_goals_next_year",
        "strengths",
        "weaknesses",
        "auditor_observations",
        "cps_full_summary_text",
      ],
    },
  },
  required: [
    "org_info",
    "management_4m",
    "business_analysis",
    "welfare_analysis",
    "cps_summary_and_audit",
  ],
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณาระบุ GEMINI_API_KEY ในไฟล์ .env.local ก่อนเริ่มต้นใช้งาน",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "ไม่พบไฟล์ PDF ในคำขอ กรุณาแนบไฟล์รายงานประจำปี" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "ประเภทไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์เอกสาร PDF (.pdf) เท่านั้น" },
        { status: 400 }
      );
    }

    // Read PDF bytes and convert directly to Base64 (NO pdf-parse or third-party text extractors used)
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    if (!base64Data || base64Data.length === 0) {
      return NextResponse.json(
        { success: false, error: "ไฟล์ PDF มีขนาด 0 ไบต์ หรือไม่สามารถอ่านข้อมูลได้" },
        { status: 400 }
      );
    }

    // Read System Instruction from prompts/cps_system_prompt.md
    const promptPath = path.join(process.cwd(), "prompts", "cps_system_prompt.md");
    let systemInstruction = "";
    try {
      systemInstruction = await fs.readFile(promptPath, "utf-8");
    } catch (readErr) {
      console.warn("Could not read prompt from file, falling back to default prompt:", readErr);
      systemInstruction = `คุณคือ นักวิชาการสหกรณ์ชำนาญการ กรมส่งเสริมสหกรณ์ วิเคราะห์ข้อมูลจาก PDF ที่แนบมาอย่างเคร่งครัดตามหลัก 4M, การบริหารธุรกิจ, สวัสดิการ และจัดทำบทสรุป CPS`;
    }

    // Initialize GoogleGenAI SDK client
    const ai = new GoogleGenAI({ apiKey });

    // Use gemini-3.8-flash as the latest standard model (or custom override from env)
    const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const userPrompt = `โปรดวิเคราะห์รายงานประจำปีสหกรณ์/กลุ่มเกษตรกรจากไฟล์ PDF ที่แนบมานี้อย่างละเอียดรอบคอบ 
ปฏิบัติตามกฎเหล็กของนักวิชาการสหกรณ์ชำนาญการ กรมส่งเสริมสหกรณ์:
1. วิเคราะห์เฉพาะข้อเท็จจริงใน PDF ห้ามคาดเดา
2. ตรวจสอบ Cross-Check ความสอดคล้องของตัวเลขระหว่างรายงานการประชุมใหญ่กับงบการเงินและรายงานผู้สอบบัญชีอย่างเคร่งครัด
3. นำเสนอผลการวิเคราะห์ตามโครงสร้าง Structured JSON Schema ครบทั้ง 5 ด้าน: org_info, management_4m, business_analysis, welfare_analysis, cps_summary_and_audit`;

    let responseText: string | null = null;

    // 1. Try modern Interactions API first (recommended by Google for gemini-3.8-flash)
    try {
      const interaction = await ai.interactions.create({
        model: modelName,
        input: [
          {
            type: "document",
            data: base64Data,
            mime_type: "application/pdf",
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
        system_instruction: systemInstruction,
        generation_config: {
          temperature: 0.1, // Strict temperature to prevent figure hallucination
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: cpsJsonSchema,
        },
      });

      responseText = interaction.output_text ?? null;
    } catch (interactionErr: unknown) {
      console.warn("Interactions API call failed, attempting fallback to models.generateContent:", interactionErr);

      // 2. Fallback to models.generateContent if Interactions API encounters issues
      const generateResponse = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          {
            text: userPrompt,
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: cpsJsonSchema,
        },
      });

      responseText = generateResponse.text ?? null;
    }

    if (!responseText) {
      return NextResponse.json(
        { success: false, error: "โมเดลไม่ส่งคืนข้อความผลลัพธ์ กรุณาลองใหม่อีกครั้ง" },
        { status: 502 }
      );
    }

    // Clean potential markdown wrap if any
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsedData: CPSAnalysisResult = JSON.parse(cleanJson);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (err: unknown) {
    console.error("CPS Analysis Error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร";
    return NextResponse.json(
      {
        success: false,
        error: `การวิเคราะห์ล้มเหลว: ${message}`,
      },
      { status: 500 }
    );
  }
}
