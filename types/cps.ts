export interface FinancialRatio {
  label: string;
  value: string;
  interpretation?: string;
}

export interface OrgInfo {
  coop_name: string;
  coop_type: string;
  fiscal_year_end: string;
  operating_capital: string;
  net_profit: string;
  total_members: string;
  internal_control_rq2: string;
  key_financial_ratios: FinancialRatio[];
}

export interface Management4M {
  man: {
    summary: string;
    member_status: string;
    committee_status: string;
    staff_and_auditor: string;
    rq2_assessment: string;
  };
  money: {
    summary: string;
    operating_capital: string;
    equity_to_debt_ratio: string;
    liquidity: string;
    debt_to_savings: string;
  };
  material: {
    summary: string;
    fixed_assets: string;
    office_and_equipment: string;
    utilization_status: string;
  };
  management: {
    summary: string;
    compliance: string;
    accounting_status: string;
    dependency_on_officials: string;
    internal_audit: string;
  };
}

export interface BusinessItem {
  business_name: string;
  volume: string;
  profit_loss: string;
  member_participation: string;
  risks_and_observations: string;
}

export interface BusinessAnalysis {
  overview: string;
  businesses: BusinessItem[];
  cross_check_notes: string[];
}

export interface ProfitAllocationItem {
  fund_name: string;
  allocated_amount: string;
  note?: string;
}

export interface ReserveFundItem {
  fund_name: string;
  beginning_balance: string;
  added_amount: string;
  disbursed_amount: string;
  ending_balance: string;
  is_utilized: string;
}

export interface WelfareAnalysis {
  profit_allocation: ProfitAllocationItem[];
  reserve_and_welfare_funds: ReserveFundItem[];
  actual_usage_summary: string;
}

export interface CPSSummaryAndAudit {
  board_performance_summary: string;
  promotion_goals_next_year: string[];
  strengths: string[];
  weaknesses: string[];
  auditor_observations: string[];
  cps_full_summary_text: string;
}

export interface CPSAnalysisResult {
  org_info: OrgInfo;
  management_4m: Management4M;
  business_analysis: BusinessAnalysis;
  welfare_analysis: WelfareAnalysis;
  cps_summary_and_audit: CPSSummaryAndAudit;
}

export interface AnalyzeApiResponse {
  success: boolean;
  data?: CPSAnalysisResult;
  error?: string;
}
