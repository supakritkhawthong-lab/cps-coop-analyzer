import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { CPSAnalysisResult } from "@/types/cps";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds is the maximum for Vercel Hobby plan

const EMBEDDED_CPS_SYSTEM_PROMPT = `คุณคือ "นักวิชาการสหกรณ์ชำนาญการพิเศษ กรมส่งเสริมสหกรณ์" ผู้เชี่ยวชาญระดับสูงด้านการวิเคราะห์รายงานประจำปี การตรวจการสหกรณ์ และการจัดทำแผนส่งเสริมสหกรณ์ (CPS: Cooperative Performance Supervision) โดยทำงานร่วมกับมาตรฐานการตรวจสอบบัญชีและการควบคุมภายในของ "กรมตรวจบัญชีสหกรณ์ (สตส.)"

# กฎเหล็กและมาตรฐานการวิเคราะห์ (Strict Forensic Rules)
1. วิเคราะห์เฉพาะข้อมูลที่ปรากฏจริงในไฟล์ PDF ห้ามคาดเดาตัวเลขทางการเงิน หากไม่มีให้ระบุ "ไม่ปรากฏข้อมูลในเอกสารรายงาน"
2. Forensic Cross-Check: ตรวจสอบความสอดคล้องระหว่างมติที่ประชุมใหญ่ vs งบการเงิน (วงเงินกู้ยืมและค้ำประกันประจำปี, การจัดสรรกำไรสุทธิตาม พ.ร.บ. สหกรณ์ มาตรา 60 เรื่องกันทุนสำรอง 10%, ยอดหนี้ผิดนัดชำระ vs การตั้งค่าเผื่อหนี้สงสัยจะสูญ)
3. ประเมินชั้นความเข้มแข็งของสหกรณ์ (ชั้น 1: เข้มแข็งมาก, ชั้น 2: เข้มแข็งปานกลาง, ชั้น 3: ต้องปรับปรุง)
4. จัดระดับความเสี่ยงของข้อสังเกตผู้สอบบัญชี สตส. ทุกข้อเป็น CRITICAL, WARNING, หรือ ADVISORY พร้อมระบุประเด็น ผลกระทบ และข้อเสนอแนะ
5. แผนส่งเสริม CPS ต้องระบุเป้าหมาย (goal), มาตรการส่งเสริมของเจ้าหน้าที่ (action_plan), และตัวชี้วัดความสำเร็จ (target_kpi)
6. สรุปผล CPS (cps_full_summary_text) ในรูปแบบบันทึกข้อความราชการทางการฉบับสมบูรณ์ พร้อมคัดลอกลงระบบ`;

// Standard JSON Schema for CPS analysis structured output
const cpsJsonSchema = {
  type: "object",
  properties: {
    org_info: {
      type: "object",
      properties: {
        coop_name: { type: "string", description: "ชื่อสหกรณ์หรือกลุ่มเกษตรกร" },
        coop_type: { type: "string", description: "ประเภทสหกรณ์ เช่น สหกรณ์การเกษตร, สหกรณ์ออมทรัพย์" },
        cooperative_strength_class: {
          type: "string",
          description: "ชั้นความเข้มแข็งของสหกรณ์ตามเกณฑ์มาตรฐาน (เช่น 'ชั้น 1 (เข้มแข็งมาก)', 'ชั้น 2 (เข้มแข็งปานกลาง)', 'ชั้น 3 (ต้องปรับปรุงแก้ไข)') พร้อมเหตุผลสั้นๆ",
        },
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
              label: { type: "string", description: "ชื่ออัตราส่วน เช่น หนี้สินต่อทุน (D/E), ROE, Current Ratio" },
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
        "cooperative_strength_class",
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
        board_performance_summary: {
          type: "string",
          description: "สรุปภาพรวมการปฏิบัติงานของคณะกรรมการดำเนินการ ความเป็นผู้นำ และการปฏิบัติตามมติที่ประชุมใหญ่",
        },
        promotion_goals_next_year: {
          type: "array",
          items: {
            type: "object",
            properties: {
              goal: { type: "string", description: "เป้าหมายการส่งเสริมสหกรณ์ในปีงบประมาณถัดไป" },
              action_plan: { type: "string", description: "มาตรการและกิจกรรมส่งเสริมของเจ้าหน้าที่ส่งเสริมสหกรณ์" },
              target_kpi: { type: "string", description: "ตัวชี้วัดความสำเร็จและกรอบเวลาในการดำเนินงาน" },
            },
            required: ["goal", "action_plan", "target_kpi"],
          },
          description: "เป้าหมายและแผนปฏิบัติการส่งเสริม CPS ปีงบประมาณถัดไป",
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "จุดเด่นและศักยภาพของสหกรณ์/กลุ่มเกษตรกร",
        },
        weaknesses: {
          type: "array",
          items: { type: "string" },
          description: "จุดอ่อนหรือข้อบกพร่องที่ต้องเร่งแก้ไข",
        },
        auditor_observations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: {
                type: "string",
                enum: ["CRITICAL", "WARNING", "ADVISORY"],
                description: "ระดับความรุนแรง: CRITICAL (วิกฤต/ข้อบกพร่องตามกฎหมาย), WARNING (เตือนภัย/ความเสี่ยงสูง), ADVISORY (ข้อเสนอแนะเชิงพัฒนา)",
              },
              issue: { type: "string", description: "ประเด็นข้อสังเกตหรือข้อบกพร่องจากรายงานของผู้สอบบัญชี สตส." },
              impact: { type: "string", description: "ผลกระทบต่อฐานะการเงิน การดำเนินธุรกิจ หรือสมาชิก" },
              recommendation: { type: "string", description: "แนวทางแก้ไขและข้อเสนอแนะของผู้สอบบัญชีหรือเจ้าหน้าที่" },
            },
            required: ["severity", "issue", "impact", "recommendation"],
          },
          description: "ข้อสังเกตและข้อเสนอแนะของผู้สอบบัญชี สตส. จำแนกตามระดับความรุนแรง",
        },
        cps_full_summary_text: {
          type: "string",
          description: "บทสรุปผลการวิเคราะห์ CPS ฉบับสมบูรณ์ ในรูปแบบบันทึกข้อความทางการ สำหรับคัดลอกลงระบบ CPS",
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

// Resilient generator that handles temporary spikes (503/429) via exponential backoff and model failover
async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  fileUri: string,
  userPrompt: string,
  systemInstruction: string,
  responseSchema: unknown
): Promise<{ text: string; usedModel: string }> {
  // Candidate models: prioritize the chosen model, but fall back to the sibling model if overwhelmed
  const candidateModels =
    primaryModel === "gemini-3.5-flash-lite"
      ? ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
      : ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

  let lastError: unknown = null;

  for (const model of candidateModels) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[CPS Analyzer] Requesting Gemini with model ${model} (attempt ${attempt}/${maxAttempts})...`);

        // Use generateContent with uploaded Google File URI and structured JSON schema
        const generateResponse = await ai.models.generateContent({
          model,
          contents: [
            {
              fileData: {
                fileUri,
                mimeType: "application/pdf",
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
            responseSchema,
          },
        });

        if (generateResponse.text) {
          return { text: generateResponse.text, usedModel: model };
        }
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        console.warn(`[CPS Analyzer] Model ${model} attempt ${attempt} failed: ${errMsg}`);

        if (isTransient && attempt < maxAttempts) {
          // Wait 2.5 seconds before retrying the same model
          console.log(`[CPS Analyzer] Temporary overload detected. Retrying ${model} in 2.5 seconds...`);
          await new Promise((r) => setTimeout(r, 2500));
        } else if (isTransient) {
          console.warn(`[CPS Analyzer] Model ${model} unavailable after ${maxAttempts} attempts. Failing over to ${candidateModels[1]}...`);
          break; // break to next candidate model
        } else {
          // Non-transient error, break immediately
          break;
        }
      }
    }
  }

  throw lastError;
}

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

    // Support files up to 100MB using Google Files API (which supports up to 2GB)
    const MAX_FILE_BYTES = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `ไฟล์ PDF มีขนาด ${(file.size / (1024 * 1024)).toFixed(1)} MB ซึ่งเกินขีดจำกัดสูงสุด 100 MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 100 MB`,
        },
        { status: 400 }
      );
    }

    // Initialize GoogleGenAI SDK client
    const ai = new GoogleGenAI({ apiKey });

    // Read System Instruction from prompts/cps_system_prompt.md
    const promptPath = path.join(process.cwd(), "prompts", "cps_system_prompt.md");
    let systemInstruction = "";
    try {
      systemInstruction = await fs.readFile(promptPath, "utf-8");
    } catch (readErr) {
      console.warn("Could not read prompt from file, falling back to embedded prompt:", readErr);
      systemInstruction = EMBEDDED_CPS_SYSTEM_PROMPT;
    }

    // Save uploaded file stream to a temporary file on disk to prevent Node.js memory spike (OOM crash)
    const tempFileName = `cps-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    // Upload to Google Gemini Files API (supports up to 2GB per file)
    let uploadedFile: any = null;
    let responseText: string | null = null;

    try {
      uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: {
          mimeType: "application/pdf",
          displayName: file.name,
        },
      });

      // Poll until file state is ACTIVE (usually instant for PDFs)
      let attempts = 0;
      while (uploadedFile.state === "PROCESSING" && attempts < 15) {
        await new Promise((r) => setTimeout(r, 1000));
        uploadedFile = await ai.files.get({ name: uploadedFile.name });
        attempts++;
      }

      if (uploadedFile.state === "FAILED") {
        throw new Error("Google Files API ประมวลผลไฟล์ไม่สำเร็จ");
      }

      // Use gemini-3.5-flash-lite as the fast default, or gemini-3.8-flash if requested
      const requestedModel = formData.get("model") as string | null;
      const modelName = requestedModel || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

      const userPrompt = `โปรดวิเคราะห์รายงานประจำปีสหกรณ์/กลุ่มเกษตรกรจากไฟล์ PDF ที่แนบมานี้อย่างละเอียดรอบคอบ 
ปฏิบัติตามกฎเหล็กของนักวิชาการสหกรณ์ชำนาญการ กรมส่งเสริมสหกรณ์:
1. วิเคราะห์เฉพาะข้อเท็จจริงใน PDF ห้ามคาดเดา
2. ตรวจสอบ Cross-Check ความสอดคล้องของตัวเลขระหว่างรายงานการประชุมใหญ่กับงบการเงินและรายงานผู้สอบบัญชีอย่างเคร่งครัด
3. นำเสนอผลการวิเคราะห์ตามโครงสร้าง Structured JSON Schema ครบทั้ง 5 ด้าน: org_info, management_4m, business_analysis, welfare_analysis, cps_summary_and_audit`;

      // Generate CPS analysis with automatic retry & model failover
      const { text: resultText, usedModel } = await generateWithRetryAndFallback(
        ai,
        modelName,
        uploadedFile.uri,
        userPrompt,
        systemInstruction,
        cpsJsonSchema
      );

      console.log(`[CPS Analyzer] Successfully generated analysis using ${usedModel}`);
      responseText = resultText;
    } finally {
      // 1. Always delete temporary file from local disk
      await fs.unlink(tempFilePath).catch(() => {});

      // 2. Always delete remote file from Google Files API storage to keep storage clean
      if (uploadedFile?.name) {
        await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
      }
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
    let friendlyMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร";

    // Attempt to extract the clean message if Google returned a raw JSON error string
    try {
      if (friendlyMessage.includes('{"error":')) {
        const jsonStart = friendlyMessage.indexOf('{"error":');
        const jsonSub = friendlyMessage.slice(jsonStart);
        const parsedErr = JSON.parse(jsonSub);
        if (parsedErr?.error?.message) {
          friendlyMessage = parsedErr.error.message;
        }
      }
    } catch {}

    // Map common Google Gemini error codes to clear, actionable Thai explanations
    if (
      friendlyMessage.includes("503") ||
      friendlyMessage.includes("UNAVAILABLE") ||
      friendlyMessage.includes("high demand")
    ) {
      friendlyMessage =
        "เซิร์ฟเวอร์ Google Gemini กำลังมีผู้ใช้งานหนาแน่นชั่วคราว (503 Service Unavailable / High Demand) ระบบได้พยายามเชื่อมต่อใหม่อัตโนมัติแล้ว กรุณารอสักครู่ (ประมาณ 10–20 วินาที) แล้วกด 'ลองใหม่อีกครั้ง' หรือสลับโหมดการประมวลผล";
    } else if (
      friendlyMessage.includes("429") ||
      friendlyMessage.includes("RESOURCE_EXHAUSTED") ||
      friendlyMessage.includes("quota")
    ) {
      friendlyMessage =
        "คำขอใช้งานเกินขีดจำกัดโควตาชั่วคราว (429 Rate Limit) กรุณารอสักครู่แล้วกดลองใหม่อีกครั้ง";
    }

    return NextResponse.json(
      {
        success: false,
        error: `การวิเคราะห์ล้มเหลว: ${friendlyMessage}`,
      },
      { status: 500 }
    );
  }
}
