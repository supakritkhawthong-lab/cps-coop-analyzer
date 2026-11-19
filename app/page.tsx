"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  Building2,
  Wallet,
  TrendingUp,
  Users,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  Briefcase,
  HeartHandshake,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  Award,
} from "lucide-react";
import { CPSAnalysisResult } from "@/types/cps";
import { generateCPSDocx } from "@/lib/docx-export";

export default function CPSAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CPSAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"4m" | "business" | "welfare" | "cps_summary">("4m");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingSteps = [
    "กำลังอ่านไฟล์ PDF เข้าสู่ระบบ...",
    "ส่งไฟล์เอกสารเข้าสู่โมเดล Gemini แบบ Inline Vision Data...",
    "วิเคราะห์โครงสร้างงบการเงินและรายงานการประชุมใหญ่...",
    "ตรวจทานความสอดคล้องตัวเลข (Cross-Check) และสกัดข้อมูลตามหลัก 4M...",
    "รวบรวมข้อสังเกตของผู้สอบบัญชีและสังเคราะห์แผนส่งเสริม CPS...",
  ];

  // Timer for loading screen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let stepTimer: NodeJS.Timeout;
    if (isAnalyzing) {
      setElapsedSeconds(0);
      setLoadingStep(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      stepTimer = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 6000);
    }
    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [isAnalyzing]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("กรุณาเลือกไฟล์ PDF (.pdf) เท่านั้น");
      return;
    }
    setErrorMessage(null);
    setFile(selectedFile);
  };

  // Trigger Analysis
  const handleStartAnalysis = async () => {
    if (!file) {
      setErrorMessage("กรุณาเลือกหรือวางไฟล์ PDF รายงานประจำปีก่อนกดวิเคราะห์");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร");
      }

      setAnalysisResult(result.data);
      setActiveTab("4m");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "การวิเคราะห์ล้มเหลว กรุณาตรวจสอบ GEMINI_API_KEY หรือลองใหม่อีกครั้ง";
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset analysis
  const handleReset = () => {
    setFile(null);
    setAnalysisResult(null);
    setErrorMessage(null);
    setCopySuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Copy CPS Summary to clipboard
  const handleCopySummary = async () => {
    if (!analysisResult) return;
    try {
      const fullSummary = analysisResult.cps_summary_and_audit.cps_full_summary_text;
      await navigator.clipboard.writeText(fullSummary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Download Word docx
  const handleDownloadDocx = async () => {
    if (!analysisResult) return;
    setIsDownloadingDocx(true);
    try {
      const blob = await generateCPSDocx(analysisResult);
      const coopName = (analysisResult.org_info.coop_name || "สหกรณ์").replace(/[\/\\?%*:|"<>]/g, "_");
      const fiscalYear = (analysisResult.org_info.fiscal_year_end || "ปีบัญชี").replace(/[\/\\?%*:|"<>]/g, "_");
      const filename = `รายงาน_CPS_${coopName}_${fiscalYear}.docx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download docx:", err);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ Word");
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Official Government Header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b-4 border-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center p-2 shadow-inner">
                <Building2 className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-400/40 font-semibold tracking-wide">
                    ระบบวิเคราะห์ข้อมูลสหกรณ์ (CPS)
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
                  ระบบวิเคราะห์รายงานประจำปีสหกรณ์และกลุ่มเกษตรกร (CPS Analyzer)
                </h1>
                <p className="text-xs sm:text-sm text-blue-200 mt-0.5">
                  เครื่องมือสกัดข้อมูลเชิงลึก 4M, งบการเงิน, ความสอดคล้องตัวเลข และจัดทำแผนส่งเสริมสหกรณ์ (CPS) ด้วย AI
                </p>
              </div>
            </div>

            {analysisResult && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition border border-white/20 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  วิเคราะห์เล่มใหม่
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-900">เกิดข้อผิดพลาด</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Upload State (When no result yet) */}
        {!analysisResult && !isAnalyzing && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Guide Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-slate-900">
                    คำแนะนำการจัดเตรียมและอัปโหลดรายงานประจำปี
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    ระบบรองรับไฟล์ <strong>รายงานกิจการประจำปี / รายงานการประชุมใหญ่สามัญประจำปี</strong> ของสหกรณ์และกลุ่มเกษตรกร (รวมงบการเงินและรายงานของผู้สอบบัญชี สตส.) 
                    โดยระบบจะส่งไฟล์ PDF แบบ Inline Data เข้าโมเดล AI เพื่ออ่านข้อมูลตารางและเอกสารสแกนโดยตรงอย่างแม่นยำ
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>วิเคราะห์ตามหลัก 4M</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Cross-Check ตัวเลขข้ามเล่ม</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>ส่งออก Word (.docx) มาตรฐาน</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-blue-600 bg-blue-50/80 scale-[1.01]"
                  : file
                  ? "border-emerald-500 bg-emerald-50/30"
                  : "border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/60"
              } shadow-sm`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition ${
                    file
                      ? "bg-emerald-100 text-emerald-700"
                      : isDragging
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {file ? <FileCheck className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      ขนาดไฟล์: {(file.size / (1024 * 1024)).toFixed(2)} MB • เอกสาร PDF พร้อมวิเคราะห์
                    </p>
                    <span className="inline-block mt-2 text-xs font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                      คลิกเพื่อเปลี่ยนไฟล์
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-800">
                      ลากไฟล์รายงานประจำปี (PDF) มาวางที่นี่
                    </p>
                    <p className="text-xs text-slate-500">
                      หรือ <span className="text-blue-700 font-medium underline">คลิกเพื่อเลือกไฟล์</span> จากคอมพิวเตอร์ของคุณ
                    </p>
                    <p className="text-[11px] text-slate-400 pt-2">
                      รองรับไฟล์ PDF เอกสารสแกนหรือดิจิทัล (ขนาดแนะนำไม่เกิน 50 MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-center">
              <button
                disabled={!file}
                onClick={handleStartAnalysis}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-sm sm:text-base shadow-md transition flex items-center justify-center gap-2.5 ${
                  file
                    ? "bg-blue-900 hover:bg-blue-800 text-white cursor-pointer hover:shadow-lg active:scale-95"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <FileText className="w-5 h-5 text-amber-400" />
                เริ่มต้นการวิเคราะห์เล่มรายงาน (AI CPS Analysis)
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse"></div>
              <div className="w-20 h-20 rounded-full border-4 border-blue-900 border-t-transparent animate-spin flex items-center justify-center">
                <Building2 className="w-8 h-8 text-blue-900 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">
                ระบบกำลังวิเคราะห์รายงานประจำปีสหกรณ์
              </h3>
              <p className="text-sm text-slate-500">
                ประมวลผลด้วย Gemini Vision Multimodal • เวลาที่ใช้ไป: {elapsedSeconds} วินาที
              </p>
            </div>

            {/* Step Progress Checklist */}
            <div className="text-left bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
              {loadingSteps.map((stepText, idx) => {
                const isDone = idx < loadingStep;
                const isCurrent = idx === loadingStep;
                return (
                  <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full border-2 border-blue-700 border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    )}
                    <span
                      className={`${
                        isCurrent
                          ? "font-semibold text-blue-900"
                          : isDone
                          ? "text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-400">
              * การวิเคราะห์เอกสารสแกนและงบการเงินหลายสิบหน้าอาจใช้เวลาประมาณ 20 - 45 วินาที
            </p>
          </div>
        )}

        {/* Results View */}
        {analysisResult && !isAnalyzing && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Banner: Coop Profile */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {analysisResult.org_info.coop_type || "สหกรณ์"}
                  </span>
                  <span className="text-xs text-slate-500">
                    วันสิ้นปีบัญชี: <strong>{analysisResult.org_info.fiscal_year_end || "-"}</strong>
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {analysisResult.org_info.coop_name || "สหกรณ์/กลุ่มเกษตรกร"}
                </h2>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleCopySummary}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                    copySuccess
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                  }`}
                >
                  {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess ? "คัดลอกบทสรุปแล้ว!" : "คัดลอกบทสรุป CPS"}
                </button>

                <button
                  disabled={isDownloadingDocx}
                  onClick={handleDownloadDocx}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-900 hover:bg-blue-800 text-white transition shadow-sm"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  {isDownloadingDocx ? "กำลังสร้างเอกสาร..." : "ดาวน์โหลดเป็นไฟล์ Word (.docx)"}
                </button>
              </div>
            </div>

            {/* 4 Summary Cards (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: ทุนดำเนินงาน */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ทุนดำเนินงานทั้งสิ้น
                  </span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-800">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {analysisResult.org_info.operating_capital || "-"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">เงินทุนหมุนเวียนและสินทรัพย์รวม</p>
                </div>
              </div>

              {/* Card 2: กำไรสุทธิ */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    กำไร (ขาดทุน) สุทธิ
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight">
                    {analysisResult.org_info.net_profit || "-"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ผลการดำเนินงานประจำปีบัญชี</p>
                </div>
              </div>

              {/* Card 3: จำนวนสมาชิก */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    จำนวนสมาชิกทั้งหมด
                  </span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {analysisResult.org_info.total_members || "-"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">สมาชิก ณ วันสิ้นปีทางบัญชี</p>
                </div>
              </div>

              {/* Card 4: RQ2 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ชั้นการควบคุมภายใน RQ2
                  </span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-extrabold text-blue-900 tracking-tight">
                    {analysisResult.org_info.internal_control_rq2 || "ไม่ระบุ"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">แบบประเมิน สตส. กรมตรวจบัญชีฯ</p>
                </div>
              </div>
            </div>

            {/* Financial Ratios Row */}
            {analysisResult.org_info.key_financial_ratios && analysisResult.org_info.key_financial_ratios.length > 0 && (
              <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  อัตราส่วนทางการเงินสำคัญ:
                </span>
                {analysisResult.org_info.key_financial_ratios.map((ratio, idx) => (
                  <div key={idx} className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                    <span className="text-slate-500">{ratio.label}: </span>
                    <strong className="text-slate-900 font-bold">{ratio.value}</strong>
                    {ratio.interpretation && (
                      <span className="text-slate-400 text-[11px] ml-1">({ratio.interpretation})</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab Navigation */}
            <div className="border-b border-slate-200">
              <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveTab("4m")}
                  className={`py-3 px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
                    activeTab === "4m"
                      ? "border-blue-900 text-blue-900 bg-white shadow-xs"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  1. การบริหารจัดการองค์กร (4M)
                </button>

                <button
                  onClick={() => setActiveTab("business")}
                  className={`py-3 px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
                    activeTab === "business"
                      ? "border-blue-900 text-blue-900 bg-white shadow-xs"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  2. การบริหารจัดการธุรกิจ & Cross-Check
                </button>

                <button
                  onClick={() => setActiveTab("welfare")}
                  className={`py-3 px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
                    activeTab === "welfare"
                      ? "border-blue-900 text-blue-900 bg-white shadow-xs"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" />
                  3. ด้านสวัสดิการ & สาธารณประโยชน์
                </button>

                <button
                  onClick={() => setActiveTab("cps_summary")}
                  className={`py-3 px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
                    activeTab === "cps_summary"
                      ? "border-blue-900 text-blue-900 bg-white shadow-xs"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  4. บทสรุป CPS & ข้อสังเกตผู้สอบบัญชี
                </button>
              </nav>
            </div>

            {/* TAB 1: 4M Analysis */}
            {activeTab === "4m" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Man */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Man: ด้านบุคลากร</h3>
                        <p className="text-xs text-slate-500">สมาชิก, กรรมการ, เจ้าหน้าที่, ผู้ตรวจสอบกิจการ</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {analysisResult.management_4m.man.summary}
                    </p>
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-blue-900">สมาชิกและการเข้าร่วมประชุม: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.man.member_status}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-900">คณะกรรมการดำเนินการ: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.man.committee_status}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-900">เจ้าหน้าที่ประจำและผู้ตรวจสอบ: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.man.staff_and_auditor}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-900">ผลการประเมินการควบคุมภายในด้านคน: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.man.rq2_assessment}</span>
                      </div>
                    </div>
                  </div>

                  {/* Money */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Money: ด้านการเงินและทุน</h3>
                        <p className="text-xs text-slate-500">ทุนดำเนินงาน, ทุนเรือนหุ้น, หนี้สิน, สภาพคล่อง</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {analysisResult.management_4m.money.summary}
                    </p>
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-emerald-800">ทุนดำเนินงานและโครงสร้างเงินทุน: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.money.operating_capital}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-800">สัดส่วนทุนตนเองต่อหนี้สิน: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.money.equity_to_debt_ratio}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-800">สภาพคล่องทางการเงิน: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.money.liquidity}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-800">สัดส่วนหนี้สินเฉลี่ยต่อเงินออมเฉลี่ย: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.money.debt_to_savings}</span>
                      </div>
                    </div>
                  </div>

                  {/* Material */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Material: ด้านทรัพย์สินและอุปกรณ์</h3>
                        <p className="text-xs text-slate-500">ทรัพย์สินถาวร, ที่ดิน, สำนักงาน, ระบบคอมพิวเตอร์</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {analysisResult.management_4m.material.summary}
                    </p>
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-amber-800">ทรัพย์สินถาวรและสิ่งปลูกสร้าง: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.material.fixed_assets}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-800">อุปกรณ์ ครุภัณฑ์ และคอมพิวเตอร์: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.material.office_and_equipment}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-800">การใช้ประโยชน์และความคุ้มค่า: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.material.utilization_status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Management */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 flex items-center justify-center">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Management: ด้านการบริหารจัดการ</h3>
                        <p className="text-xs text-slate-500">การปฏิบัติตามกฎหมาย, ระบบบัญชี, การพึ่งพาภาครัฐ</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {analysisResult.management_4m.management.summary}
                    </p>
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-indigo-900">การปฏิบัติตามกฎหมายและข้อบังคับ: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.management.compliance}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-900">การจัดทำบัญชีขั้นต้น-ขั้นปลาย: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.management.accounting_status}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-900">ระดับการพึ่งพาเจ้าหน้าที่รัฐ: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.management.dependency_on_officials}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-900">ประสิทธิภาพการตรวจสอบภายใน: </span>
                        <span className="text-slate-700">{analysisResult.management_4m.management.internal_audit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Business Analysis & Cross-Check */}
            {activeTab === "business" && (
              <div className="space-y-6">
                {/* Overview */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-900" />
                    ภาพรวมการดำเนินธุรกิจของสหกรณ์/กลุ่มเกษตรกร
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {analysisResult.business_analysis.overview}
                  </p>
                </div>

                {/* Business Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm">
                      ตารางแจกแจงผลการดำเนินงานแต่ละธุรกิจ
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="p-3.5">ชื่อธุรกิจ</th>
                          <th className="p-3.5">ปริมาณธุรกิจ (เทียบเป้าหมาย)</th>
                          <th className="p-3.5">กำไร (ขาดทุน) เฉพาะธุรกิจ</th>
                          <th className="p-3.5">การมีส่วนร่วมของสมาชิก</th>
                          <th className="p-3.5">ข้อสังเกต & จุดเสี่ยงแฝง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {analysisResult.business_analysis.businesses.map((biz, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="p-3.5 font-semibold text-blue-900 whitespace-nowrap">
                              {biz.business_name}
                            </td>
                            <td className="p-3.5">{biz.volume || "-"}</td>
                            <td className="p-3.5 font-medium">{biz.profit_loss || "-"}</td>
                            <td className="p-3.5">{biz.member_participation || "-"}</td>
                            <td className="p-3.5 text-slate-600 max-w-xs">{biz.risks_and_observations || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cross-Check Alert Box */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h4>ผลการตรวจทานความสอดคล้องของตัวเลข (Cross-Check ระหว่างรายงานการประชุมใหญ่ vs งบการเงิน)</h4>
                  </div>
                  <p className="text-xs text-amber-800">
                    การเปรียบเทียบวงเงินกู้ยืม การค้ำประกัน การจัดสรรกำไร และยอดดำเนินธุรกิจจริงตามกฎเหล็กของนักวิชาการสหกรณ์
                  </p>
                  <ul className="space-y-2 pt-1">
                    {analysisResult.business_analysis.cross_check_notes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800">
                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 3: Welfare & Reserve Funds */}
            {activeTab === "welfare" && (
              <div className="space-y-6">
                {/* Profit Allocation */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-blue-900" />
                    การจัดสรรกำไรสุทธิประจำปี (Profit Allocation)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analysisResult.welfare_analysis.profit_allocation.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-500">{item.fund_name}</p>
                        <p className="text-base font-bold text-slate-900 mt-1">{item.allocated_amount}</p>
                        {item.note && <p className="text-[11px] text-slate-400 mt-0.5">{item.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reserve and Welfare Funds Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm">
                      การวิเคราะห์ทุนสะสมตามข้อบังคับและทุนสวัสดิการ (จากหมายเหตุประกอบงบการเงิน)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ตรวจสอบยอดยกมา + ยอดจัดสรรเพิ่ม เทียบกับยอดเบิกใช้จริง และยอดคงเหลือสิ้นปี
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="p-3.5">ชื่อกองทุน/ทุนสะสม</th>
                          <th className="p-3.5">ยอดยกมาต้นปี</th>
                          <th className="p-3.5">จัดสรรเพิ่มระหว่างปี</th>
                          <th className="p-3.5">เบิกจ่ายไปใช้จริง</th>
                          <th className="p-3.5">คงเหลือสิ้นปี</th>
                          <th className="p-3.5">สถานะการนำไปใช้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {analysisResult.welfare_analysis.reserve_and_welfare_funds.map((fund, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="p-3.5 font-semibold text-blue-900">{fund.fund_name}</td>
                            <td className="p-3.5">{fund.beginning_balance || "-"}</td>
                            <td className="p-3.5 font-medium text-emerald-700">{fund.added_amount || "-"}</td>
                            <td className="p-3.5 font-medium text-amber-700">{fund.disbursed_amount || "-"}</td>
                            <td className="p-3.5 font-bold text-slate-900">{fund.ending_balance || "-"}</td>
                            <td className="p-3.5">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                {fund.is_utilized || "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actual Usage Summary */}
                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 space-y-2">
                  <h4 className="font-bold text-blue-900 text-sm">
                    ข้อวินิจฉัยด้านการเบิกจ่ายสวัสดิการจริงแก่สมาชิก
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {analysisResult.welfare_analysis.actual_usage_summary}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: CPS Summary & Audit Observations */}
            {activeTab === "cps_summary" && (
              <div className="space-y-6">
                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold pb-2 border-b border-slate-100">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h4>จุดเด่นของสหกรณ์/กลุ่มเกษตรกร</h4>
                    </div>
                    <ul className="space-y-2 pt-1">
                      {analysisResult.cps_summary_and_audit.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-rose-800 font-bold pb-2 border-b border-slate-100">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                      <h4>จุดอ่อนและข้อบกพร่องที่ต้องเร่งแก้ไข</h4>
                    </div>
                    <ul className="space-y-2 pt-1">
                      {analysisResult.cps_summary_and_audit.weaknesses.map((w, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <span className="text-rose-600 font-bold mt-0.5">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Board Performance Summary */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-900" />
                    สรุปภาพรวมการปฏิบัติงานของคณะกรรมการดำเนินการ
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {analysisResult.cps_summary_and_audit.board_performance_summary}
                  </p>
                </div>

                {/* Auditor Observations */}
                <div className="bg-amber-50/50 rounded-2xl p-6 border border-amber-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold pb-2 border-b border-amber-200/60">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h4>ข้อสังเกตและข้อเสนอแนะของผู้สอบบัญชี (สำนักงานตรวจบัญชีสหกรณ์ สตส.)</h4>
                  </div>
                  <ul className="space-y-2.5 pt-1">
                    {analysisResult.cps_summary_and_audit.auditor_observations.map((obs, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 bg-white/70 p-3 rounded-xl border border-amber-200/40">
                        <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] flex-shrink-0 font-bold mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Year Promotion Goals */}
                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-bold pb-2 border-b border-blue-200/60">
                    <Award className="w-5 h-5 text-blue-700" />
                    <h4>เป้าหมายในการส่งเสริมปีงบประมาณถัดไป (CPS Goals)</h4>
                  </div>
                  <ul className="space-y-2 pt-1">
                    {analysisResult.cps_summary_and_audit.promotion_goals_next_year.map((goal, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CPS Full Text for Copying */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        บทสรุป CPS ฉบับสมบูรณ์ (พร้อมสำหรับนำไปบันทึกลงระบบ CPS)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        คัดลอกข้อความด้านล่างนี้ไปวางในระบบบริหารงานส่งเสริมสหกรณ์ได้ทันที
                      </p>
                    </div>
                    <button
                      onClick={handleCopySummary}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        copySuccess
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copySuccess ? "คัดลอกแล้ว" : "คัดลอก"}
                    </button>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {analysisResult.cps_summary_and_audit.cps_full_summary_text}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <p>
          ระบบวิเคราะห์รายงานประจำปีสหกรณ์และกลุ่มเกษตรกร (CPS Analyzer) • พัฒนาสำหรับนักวิชาการสหกรณ์
        </p>
        <p className="mt-1 text-slate-400">
          ขับเคลื่อนด้วยเทคโนโลยี Gemini Multimodal Vision API
        </p>
      </footer>
    </div>
  );
}
