export interface WorkflowBilling {
  pointsCharged: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  billableTokens: number;
  imageCount: number;
  estimated: boolean;
  status: 'settled' | 'simulated' | 'pending' | 'released';
  ruleVersion?: string;
}

export interface WorkflowCreditAccount {
  balance: number;
  reservedPoints: number;
  totalRecharged: number;
  totalConsumed: number;
}

export interface WorkflowCreditRules {
  version: string;
  pointsPerYuan: number;
  tokensPerPoint: number;
  text: { tokensPerPoint: number; maxOutputTokens: number };
  image: { pointsPerImage: number; sizeMultipliers: Record<string, number> };
  plans: Array<{
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    monthlyPoints: number;
  }>;
  notes: string[];
}

export interface WorkflowCredits {
  account: WorkflowCreditAccount;
  rules: WorkflowCreditRules;
}

export interface WorkflowCreditLedgerEntry {
  _id: string;
  type: 'recharge' | 'reserve' | 'settle' | 'release';
  points: number;
  balanceAfter: number;
  remark?: string;
  createdAt?: string;
  operatorName?: string;
  executionId?: string;
  nodeId?: string;
}

export interface WorkflowCreditLedger {
  list: WorkflowCreditLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
}
