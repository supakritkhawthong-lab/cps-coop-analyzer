import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบวิเคราะห์รายงานประจำปีสหกรณ์และกลุ่มเกษตรกร (CPS Analyzer)",
  description: "ระบบวิเคราะห์รายงานการประชุมใหญ่ งบการเงิน และจัดทำแผนส่งเสริมสหกรณ์ (CPS) ด้วย AI อัจฉริยะ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
