import csv
import io
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Union

from app.models.record import FileRecord, Task
from app.services.xlsx_reader import read_xls_rows, read_xlsx_rows


HEADER_ALIASES = {
    "period": ["期间", "所属期", "所属月份", "月份", "年月", "期次", "month", "period", "date", "开票日期", "日期"],
    "company_name": ["企业名称", "纳税人名称", "公司名称", "单位名称", "company_name", "company"],
    "taxpayer_id": ["纳税人识别号", "税号", "统一社会信用代码", "taxpayer_id", "tin"],
    "amount": ["金额", "不含税金额", "销售额", "采购额", "收入金额", "cost", "amount", "sales_amount", "purchase_amount"],
    "tax_amount": ["税额", "税金", "output_tax", "input_tax", "tax_amount"],
    "gross_amount": ["价税合计", "含税金额", "total_amount", "gross_amount"],
    "customer_name": ["购方名称", "客户名称", "客户", "customer_name", "buyer_name"],
    "vendor_name": ["销方名称", "供应商名称", "供应商", "vendor_name", "seller_name"],
    "item_name": ["商品名称", "货物或应税劳务名称", "项目名称", "item_name", "product_name"],
    "invoice_status": ["发票状态", "状态", "status", "invoice_status"],
    "voucher_type": ["凭证类型", "票据类型", "单据类型", "附件类型", "voucher_type"],
    "expense_amount": ["费用金额", "报销金额", "expense_amount"],
    "revenue": ["主营业务收入", "营业收入", "收入总额", "revenue", "sales_revenue"],
    "cost": ["主营业务成本", "营业成本", "成本费用", "cost"],
    "profit": ["利润总额", "利润", "profit"],
    "taxable_income": ["应纳税所得额", "taxable_income"],
    "inventory_begin": ["期初存货", "期初库存", "inventory_begin"],
    "inventory_end": ["期末存货", "期末库存", "inventory_end"],
    "sales_declared": ["申报销售额", "销项销售额", "vat_sales", "sales_declared"],
    "input_declared": ["申报进项", "进项税额", "input_declared"],
    "output_declared": ["申报销项", "销项税额", "output_declared"],
    "salary_amount": ["工资薪金", "工资薪金总额", "工资总额", "salary_amount", "payroll"],
    "employee_count": ["人数", "员工人数", "申报人数", "employee_count"],
    "pit_tax_amount": ["个人所得税", "个税税额", "已缴个税", "pit_tax_amount"],
    "data_kind": ["资料类型", "数据类型", "data_kind"],
}

REQUIRED_FIELDS = {
    "sales_invoice": ["period", "amount", "customer_name", "item_name"],
    "purchase_invoice": ["period", "amount", "vendor_name", "item_name"],
    "vat_return": ["period", "sales_declared", "output_declared", "input_declared"],
    "cit_return": ["period", "revenue", "cost", "profit", "taxable_income"],
    "pit_return": ["period", "salary_amount", "employee_count", "pit_tax_amount"],
    "financial_statement": ["period", "revenue", "cost", "inventory_begin", "inventory_end"],
    "expense_detail": ["period", "expense_amount", "voucher_type"],
}


RISK_LIBRARY = {
    "有进无销": {
        "severity": "high",
        "rectify": "逐笔说明采购流向、库存去向和未形成销售的原因，补充合同、出入库和销售证明；确属未申报收入的，应及时更正申报。",
        "notice_basis": "进项发票、增值税申报、利润表收入、库存数据之间存在明显断裂。",
        "verification": "核对进货后是否实际形成库存、领用或销售；检查是否存在延迟确认收入、账外销售或异常留抵。",
        "materials": ["采购合同", "入库单", "出库单", "销售合同", "物流单据", "库存台账"],
        "judgment": "若采购和进项连续发生且规模较大，但同期销项、收入长期偏低且无法由库存增长合理解释，可判断存在有进无销风险。",
    },
    "有销无进": {
        "severity": "high",
        "rectify": "说明销售对应货源、成本归集方式和库存变动依据，补充进货、生产或服务成本支撑资料；确有少列成本或虚开发票情形的，应及时整改。",
        "notice_basis": "销项发票、收入规模明显高于进项、采购或成本支撑。",
        "verification": "核对销售形成来源，是外购、自产还是劳务；检查库存是否异常下降，成本是否长期偏低。",
        "materials": ["销售合同", "出库单", "生产记录", "采购台账", "成本归集底稿", "库存明细账"],
        "judgment": "若销售规模持续较大而同期进货、成本和库存消耗不足以支撑，可判断存在有销无进风险。",
    },
    "变票": {
        "severity": "medium",
        "rectify": "核实异常期开票集中、购销方集中或品名突变原因，补充业务背景和交易实质证明。",
        "notice_basis": "发票时间序列、购销对象集中度或品名结构出现异常波动。",
        "verification": "核对异常期间是否真实发生批量交易，检查发票开具时间、对象切换频次、品名和税率结构。",
        "materials": ["异常期开票清单", "合同订单", "付款凭证", "物流单据", "商品明细台账"],
        "judgment": "若异常期间存在集中开票、对象高度集中、品名结构突变且缺乏真实交易支撑，可判断存在变票风险。",
    },
    "购销不匹配": {
        "severity": "high",
        "rectify": "说明采购、销售、库存和成本之间的勾稽关系，补充库存盘点和收发存台账，修正不一致数据。",
        "notice_basis": "采购、销售、库存、成本之间未形成逻辑闭环。",
        "verification": "重点核对购入规模、销售规模、期初期末库存及成本结转口径，判断是否存在异常压库或无货销售。",
        "materials": ["库存台账", "进销存报表", "成本结转底稿", "入库单", "出库单"],
        "judgment": "若购销差异显著且库存变化无法解释，则可判断存在购销不匹配风险。",
    },
    "白条入账": {
        "severity": "medium",
        "rectify": "对无合法票据支撑的费用逐笔补充发票或合法凭证，不能补证的应按规定进行纳税调整。",
        "notice_basis": "费用或成本入账凭据中存在收据、白条或无票附件。",
        "verification": "核对费用真实性、业务必要性和票据合法性，判断是否已取得合规发票。",
        "materials": ["报销单", "付款凭证", "合同", "发票", "费用审批单"],
        "judgment": "若成本费用列支仅以白条、收据或说明代替合法票据，且金额较大，则可判断存在白条入账风险。",
    },
    "虚列成本": {
        "severity": "high",
        "rectify": "说明成本确认依据和归集口径，补充进货、服务、人工、费用分摊材料；无法提供支撑的应依法调增应纳税所得额。",
        "notice_basis": "成本费用规模明显高于进项、采购或业务规模支撑。",
        "verification": "重点比对企业所得税成本、财务报表成本、采购发票和库存结转，检查是否虚增成本或费用。",
        "materials": ["成本明细账", "采购合同", "发票清单", "人工及费用分摊表", "结转凭证"],
        "judgment": "若成本显著高于采购、库存消耗及业务规模，且缺乏真实支撑，可判断存在虚列成本风险。",
    },
    "隐瞒收入": {
        "severity": "high",
        "rectify": "对比财务报表、发票和申报口径，逐项说明差异原因；属于少计收入、未申报收入的，应及时补正申报。",
        "notice_basis": "财务收入、销项发票和税务申报之间存在明显收入差异。",
        "verification": "核对账载收入、开票收入、未开票收入和申报销售额，判断是否存在账外收入或申报不足。",
        "materials": ["收入明细账", "开票清单", "申报表", "银行流水", "合同订单"],
        "judgment": "若财务收入或开票收入显著高于申报收入，且差异无法合理解释，可判断存在隐瞒收入风险。",
    },
    "个税申报异常": {
        "severity": "medium",
        "rectify": "核对工资薪金、劳务报酬、人员数量与个税申报记录，补充工资表、个税扣缴明细和银行代发记录；确有少申报的，应及时更正申报。",
        "notice_basis": "个人所得税补录或扣缴数据存在税额、人数、工资薪金之间的异常关系。",
        "verification": "核对企业工资费用、员工人数、个税扣缴申报人数和实发工资流水，判断是否存在未足额扣缴申报。",
        "materials": ["工资表", "个税扣缴申报明细", "员工花名册", "银行代发流水", "劳务合同"],
        "judgment": "若工资薪金金额较大但个税税额或申报人数异常偏低，应提示个税申报异常风险。",
    },
}


@dataclass
class NormalizedInvoice:
    period: str
    amount: float
    tax_amount: float = 0.0
    gross_amount: float = 0.0
    counterparty: str = ""
    item_name: str = ""
    invoice_status: str = ""
    invoice_date: str = ""


@dataclass
class NormalizedTaxAnalysis:
    company_name: str = ""
    taxpayer_id: str = ""
    periods: set[str] = field(default_factory=set)
    sales_invoices: list[NormalizedInvoice] = field(default_factory=list)
    purchase_invoices: list[NormalizedInvoice] = field(default_factory=list)
    vat_returns: dict[str, dict[str, float]] = field(default_factory=dict)
    cit_returns: dict[str, dict[str, float]] = field(default_factory=dict)
    pit_returns: dict[str, dict[str, float]] = field(default_factory=dict)
    finance: dict[str, dict[str, float]] = field(default_factory=dict)
    expense_rows: list[dict[str, Any]] = field(default_factory=list)
    data_warnings: list[str] = field(default_factory=list)
    source_files: list[str] = field(default_factory=list)


def canonical_header(value: str) -> str:
    text = str(value or "").strip()
    lower = text.lower()
    for key, aliases in HEADER_ALIASES.items():
        if lower == key:
            return key
        if any(lower == alias.lower() for alias in aliases):
            return key
    return text


def to_amount(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "").replace("，", "")
    if not text:
        return 0.0
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else 0.0


def normalize_period(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return "未识别期间"
    text = text.replace("/", "-").replace(".", "-").replace("年", "-").replace("月", "")
    match = re.search(r"(20\d{2})[-]?(0?[1-9]|1[0-2])", text)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    year_match = re.search(r"(20\d{2})", text)
    if year_match:
        return year_match.group(1)
    return text[:20]


def safe_text(value: Any) -> str:
    return str(value or "").strip()


def load_file_rows(file_record: FileRecord) -> tuple[list[dict[str, Any]], str]:
    path = Path(file_record.path)
    suffix = path.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"} or (file_record.mime_type or "").startswith("image/"):
        return [], "image"
    raw = path.read_bytes() if path.exists() else b""
    if not raw:
        return [], "empty"

    if suffix == ".json":
        payload = json.loads(raw.decode("utf-8", errors="ignore"))
        if isinstance(payload, dict):
            for key in ("rows", "data", "items", "list", "records"):
                if isinstance(payload.get(key), list):
                    return [normalize_row(item) for item in payload[key] if isinstance(item, dict)], "json"
            return [normalize_row(payload)], "json"
        if isinstance(payload, list):
            return [normalize_row(item) for item in payload if isinstance(item, dict)], "json"
        return [], "json"

    if suffix in (".csv", ".txt", ".tsv"):
        text = raw.decode("utf-8", errors="ignore")
        delimiter = "\t" if suffix == ".tsv" else ","
        if suffix == ".txt" and "\t" in text and "," not in text:
            delimiter = "\t"
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        if reader.fieldnames:
            return [normalize_row(item) for item in reader], "csv"
        return [{"text": text[:5000]}], "text"

    if suffix == ".xlsx":
        return [normalize_row(item) for item in read_xlsx_rows(str(path))], "xlsx"
    if suffix == ".xls":
        return [normalize_row(item) for item in read_xls_rows(str(path))], "xls"

    return [{"text": raw[:5000].decode("utf-8", errors="ignore")}], "text"


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {canonical_header(key): value for key, value in row.items()}


def detect_dataset_kind(file_record: FileRecord, rows: list[dict[str, Any]]) -> str:
    filename = file_record.original_name.lower()
    keys = {str(key).lower() for row in rows[:5] for key in row.keys()}
    values = {str(value).lower() for row in rows[:5] for value in row.values()}
    text = " ".join(keys | values) + " " + filename

    if any(token in text for token in ["图片", "扫描", "image", "scan", "evidence"]):
        return "image_evidence"

    if any(token in text for token in ["销项", "销售发票", "sale", "sales_invoice", "buyer_name", "customer_name"]):
        return "sales_invoice"
    if any(token in text for token in ["进项", "采购发票", "purchase", "input_invoice", "vendor_name", "seller_name"]):
        return "purchase_invoice"
    if any(token in text for token in ["增值税", "vat", "output_declared", "input_declared", "sales_declared"]):
        return "vat_return"
    if any(token in text for token in ["所得税", "cit", "taxable_income", "应纳税所得额"]):
        return "cit_return"
    if any(token in text for token in ["个人所得税", "个税", "pit", "pit_tax_amount", "employee_count", "工资薪金"]):
        return "pit_return"
    if any(token in text for token in ["利润表", "财务", "revenue", "inventory_begin", "inventory_end"]):
        return "financial_statement"
    if any(token in text for token in ["费用", "报销", "voucher_type", "expense_amount", "白条"]):
        return "expense_detail"
    return "unknown"


def merge_company_context(analysis: NormalizedTaxAnalysis, row: dict[str, Any]) -> None:
    if not analysis.company_name and safe_text(row.get("company_name")):
        analysis.company_name = safe_text(row.get("company_name"))
    if not analysis.taxpayer_id and safe_text(row.get("taxpayer_id")):
        analysis.taxpayer_id = safe_text(row.get("taxpayer_id"))


def append_invoice(target: list[NormalizedInvoice], row: dict[str, Any]) -> None:
    period = normalize_period(row.get("period"))
    target.append(
        NormalizedInvoice(
            period=period,
            amount=to_amount(row.get("amount")),
            tax_amount=to_amount(row.get("tax_amount")),
            gross_amount=to_amount(row.get("gross_amount")),
            counterparty=safe_text(row.get("customer_name") or row.get("vendor_name")),
            item_name=safe_text(row.get("item_name")),
            invoice_status=safe_text(row.get("invoice_status")),
            invoice_date=safe_text(row.get("period")),
        )
    )


def aggregate_amounts(rows: list[NormalizedInvoice]) -> dict[str, float]:
    result: dict[str, float] = defaultdict(float)
    for row in rows:
        result[row.period] += row.amount
    return dict(result)


def month_label(period: str) -> str:
    return period if period != "未识别期间" else "未识别期间"


def build_evidence(lines: list[str]) -> list[str]:
    return [line for line in lines if line]


DATASET_LABELS = {
    "sales_invoice": "销项发票",
    "purchase_invoice": "进项发票",
    "vat_return": "增值税申报表",
    "cit_return": "企业所得税申报表",
    "pit_return": "个人所得税申报表",
    "financial_statement": "财务报表",
    "expense_detail": "费用明细",
    "invoice_pool": "发票进销数据",
}


def money_text(value: float) -> str:
    return f"{value:.2f} 元"


def ratio_text(numerator: float, denominator: float) -> str:
    if abs(denominator) < 0.000001:
        return "无法计算（分母为 0）"
    return f"{numerator / denominator:.2f} 倍"


def source_ref(dataset_kind: str, period: str, field_name: str, field_label: str, value: Union[float, int, str]) -> dict[str, Any]:
    return {
        "dataset_kind": dataset_kind,
        "dataset_label": DATASET_LABELS.get(dataset_kind, dataset_kind),
        "period": period,
        "field_name": field_name,
        "field_label": field_label,
        "value": round(value, 2) if isinstance(value, (int, float)) else value,
    }


def format_source_refs(refs: list[dict[str, Any]]) -> str:
    parts = []
    for ref in refs:
        value = ref.get("value", "")
        if isinstance(value, (int, float)):
            value = money_text(float(value)) if "金额" in ref.get("field_label", "") or "收入" in ref.get("field_label", "") or "成本" in ref.get("field_label", "") or "库存" in ref.get("field_label", "") else str(value)
        parts.append(f"{ref.get('dataset_label', '资料')}[{ref.get('period', '期间待核实')}] {ref.get('field_label', ref.get('field_name', '字段'))}={value}")
    return "；".join(parts) or "暂无明确数据引用"


def make_risk(
    risk_type: str,
    period: str,
    issue: str,
    evidence: list[str],
    confidence: float,
    metrics: dict[str, float],
    rule_name: str,
    trigger_reason: str,
    threshold_text: str,
    calculation_text: str,
    source_data_refs: list[dict[str, Any]],
) -> dict[str, Any]:
    library = RISK_LIBRARY[risk_type]
    return {
        "risk_type": risk_type,
        "severity": library["severity"],
        "period": period,
        "issue": issue,
        "evidence": evidence,
        "confidence": round(confidence, 2),
        "metrics": {key: round(value, 2) for key, value in metrics.items()},
        "rectify_advice": library["rectify"],
        "notice_basis_data": library["notice_basis"],
        "verification_focus": library["verification"],
        "required_materials": library["materials"],
        "judgment_rule": library["judgment"],
        "rule_name": rule_name,
        "trigger_reason": trigger_reason,
        "threshold_text": threshold_text,
        "calculation_text": calculation_text,
        "source_data_refs": source_data_refs,
    }


def summarize_periods(analysis: NormalizedTaxAnalysis) -> list[str]:
    periods = sorted(period for period in analysis.periods if period)
    return periods or ["未识别期间"]


def detect_risks(analysis: NormalizedTaxAnalysis) -> list[dict[str, Any]]:
    risks: list[dict[str, Any]] = []
    sales_by_period = aggregate_amounts(analysis.sales_invoices)
    purchase_by_period = aggregate_amounts(analysis.purchase_invoices)
    all_periods = set(sales_by_period) | set(purchase_by_period) | set(analysis.vat_returns) | set(analysis.cit_returns) | set(analysis.pit_returns) | set(analysis.finance)

    for period in sorted(all_periods):
        sales = max(
            sales_by_period.get(period, 0.0),
            analysis.vat_returns.get(period, {}).get("sales_declared", 0.0),
            analysis.finance.get(period, {}).get("revenue", 0.0),
        )
        purchase = purchase_by_period.get(period, 0.0)
        cit_revenue = analysis.cit_returns.get(period, {}).get("revenue", 0.0)
        cost = max(
            analysis.finance.get(period, {}).get("cost", 0.0),
            analysis.cit_returns.get(period, {}).get("cost", 0.0),
        )
        inventory_begin = analysis.finance.get(period, {}).get("inventory_begin", 0.0)
        inventory_end = analysis.finance.get(period, {}).get("inventory_end", 0.0)
        inventory_delta = inventory_end - inventory_begin

        if purchase >= 5000 and purchase > max(sales, 1.0) * 1.8:
            risks.append(make_risk(
                "有进无销",
                period,
                f"{month_label(period)} 采购/进项规模明显高于销售规模，存在进货后未见相应销售或收入确认不足的迹象。",
                build_evidence([
                    f"采购或进项金额约 {purchase:.2f} 元。",
                    f"销售或收入金额约 {sales:.2f} 元。",
                    f"库存变动约 {inventory_delta:.2f} 元。",
                ]),
                0.86,
                {"purchase_amount": purchase, "sales_amount": sales, "inventory_delta": inventory_delta},
                "进项采购与销售收入比对",
                f"{month_label(period)} 采购或进项金额明显高于销售或申报收入，采购规模为销售规模的 {ratio_text(purchase, max(sales, 1.0))}。",
                "采购或进项金额不低于 5,000 元，且采购/进项金额大于销售或收入金额的 1.8 倍。",
                f"{money_text(purchase)} ÷ {money_text(max(sales, 1.0))} = {ratio_text(purchase, max(sales, 1.0))}；库存变动 {money_text(inventory_delta)}。",
                [
                    source_ref("purchase_invoice", period, "amount", "采购或进项金额", purchase),
                    source_ref("sales_invoice", period, "amount", "销售或收入金额", sales),
                    source_ref("financial_statement", period, "inventory_delta", "库存变动", inventory_delta),
                ],
            ))

        stock_support = max(purchase + max(inventory_begin - inventory_end, 0.0), cost, 1.0)
        if sales >= 5000 and sales > stock_support * 1.8:
            risks.append(make_risk(
                "有销无进",
                period,
                f"{month_label(period)} 销售规模明显高于进货、库存消耗和成本支撑，存在无货销售或成本支撑不足迹象。",
                build_evidence([
                    f"销售或收入金额约 {sales:.2f} 元。",
                    f"采购金额约 {purchase:.2f} 元。",
                    f"成本金额约 {cost:.2f} 元。",
                ]),
                0.84,
                {"sales_amount": sales, "purchase_amount": purchase, "cost_amount": cost},
                "销售收入与进货成本支撑比对",
                f"{month_label(period)} 销售或收入金额明显高于采购、库存消耗和成本支撑，销售规模为支撑金额的 {ratio_text(sales, stock_support)}。",
                "销售或收入金额不低于 5,000 元，且销售金额大于进货、库存消耗或成本支撑金额的 1.8 倍。",
                f"{money_text(sales)} ÷ {money_text(stock_support)} = {ratio_text(sales, stock_support)}。",
                [
                    source_ref("sales_invoice", period, "amount", "销售或收入金额", sales),
                    source_ref("purchase_invoice", period, "amount", "采购金额", purchase),
                    source_ref("financial_statement", period, "cost", "成本金额", cost),
                ],
            ))

        mismatch_base = max(sales, purchase, cost, 1.0)
        mismatch_gap = abs((purchase + inventory_begin) - (sales + inventory_end))
        if mismatch_gap / mismatch_base >= 0.45 and max(sales, purchase) >= 5000:
            risks.append(make_risk(
                "购销不匹配",
                period,
                f"{month_label(period)} 采购、销售与库存变化未形成闭环，购销勾稽关系异常。",
                build_evidence([
                    f"采购金额约 {purchase:.2f} 元，销售金额约 {sales:.2f} 元。",
                    f"期初库存约 {inventory_begin:.2f} 元，期末库存约 {inventory_end:.2f} 元。",
                    f"勾稽差额约 {mismatch_gap:.2f} 元。",
                ]),
                0.8,
                {"purchase_amount": purchase, "sales_amount": sales, "inventory_begin": inventory_begin, "inventory_end": inventory_end},
                "采购销售库存勾稽比对",
                f"{month_label(period)} 采购加期初库存与销售加期末库存之间差额较大，占比较高。",
                "勾稽差额 ÷ 采购、销售、成本中的最大金额不低于 45%，且采购或销售金额不低于 5,000 元。",
                f"|({money_text(purchase)} + {money_text(inventory_begin)}) - ({money_text(sales)} + {money_text(inventory_end)})| = {money_text(mismatch_gap)}；占比 {mismatch_gap / mismatch_base:.2%}。",
                [
                    source_ref("purchase_invoice", period, "amount", "采购金额", purchase),
                    source_ref("sales_invoice", period, "amount", "销售金额", sales),
                    source_ref("financial_statement", period, "inventory_begin", "期初库存", inventory_begin),
                    source_ref("financial_statement", period, "inventory_end", "期末库存", inventory_end),
                ],
            ))

        declared_revenue = max(
            analysis.vat_returns.get(period, {}).get("sales_declared", 0.0),
            cit_revenue,
            1.0,
        )
        observable_revenue = max(sales_by_period.get(period, 0.0), analysis.finance.get(period, {}).get("revenue", 0.0))
        if observable_revenue >= 5000 and observable_revenue > declared_revenue * 1.2:
            risks.append(make_risk(
                "隐瞒收入",
                period,
                f"{month_label(period)} 账载或开票收入高于申报收入，存在少计或未申报收入风险。",
                build_evidence([
                    f"财务/开票收入约 {observable_revenue:.2f} 元。",
                    f"申报收入约 {declared_revenue:.2f} 元。",
                ]),
                0.88,
                {"observable_revenue": observable_revenue, "declared_revenue": declared_revenue},
                "账载开票收入与申报收入比对",
                f"{month_label(period)} 财务报表或销项发票反映的收入高于增值税/企业所得税申报收入。",
                "财务或开票可观察收入不低于 5,000 元，且超过申报收入的 1.2 倍。",
                f"{money_text(observable_revenue)} ÷ {money_text(declared_revenue)} = {ratio_text(observable_revenue, declared_revenue)}。",
                [
                    source_ref("sales_invoice", period, "amount", "财务/开票收入", observable_revenue),
                    source_ref("vat_return", period, "sales_declared", "申报收入", declared_revenue),
                ],
            ))

        support_cost = max(purchase + max(inventory_begin - inventory_end, 0.0), 1.0)
        if cost >= 5000 and cost > support_cost * 1.35:
            risks.append(make_risk(
                "虚列成本",
                period,
                f"{month_label(period)} 成本费用规模显著高于采购和库存消耗支撑，存在虚列成本风险。",
                build_evidence([
                    f"成本金额约 {cost:.2f} 元。",
                    f"采购与库存消耗支撑约 {support_cost:.2f} 元。",
                ]),
                0.82,
                {"cost_amount": cost, "support_cost": support_cost},
                "成本费用与采购库存支撑比对",
                f"{month_label(period)} 成本金额显著高于采购和库存消耗能够支撑的金额。",
                "成本金额不低于 5,000 元，且大于采购与库存消耗支撑金额的 1.35 倍。",
                f"{money_text(cost)} ÷ {money_text(support_cost)} = {ratio_text(cost, support_cost)}。",
                [
                    source_ref("financial_statement", period, "cost", "成本金额", cost),
                    source_ref("purchase_invoice", period, "amount", "采购与库存消耗支撑", support_cost),
                ],
            ))

        pit = analysis.pit_returns.get(period, {})
        salary_amount = pit.get("salary_amount", 0.0)
        employee_count = pit.get("employee_count", 0.0)
        pit_tax_amount = pit.get("pit_tax_amount", 0.0)
        if salary_amount >= 10000 and (employee_count <= 0 or pit_tax_amount <= 0):
            risks.append(make_risk(
                "个税申报异常",
                period,
                f"{month_label(period)} 工资薪金或劳务报酬金额较大，但个税申报人数或税额异常偏低。",
                build_evidence([
                    f"工资薪金/劳务报酬金额约 {salary_amount:.2f} 元。",
                    f"申报人数约 {employee_count:.0f} 人。",
                    f"个税税额约 {pit_tax_amount:.2f} 元。",
                ]),
                0.72,
                {"salary_amount": salary_amount, "employee_count": employee_count, "pit_tax_amount": pit_tax_amount},
                "个人所得税申报人数税额比对",
                f"{month_label(period)} 工资薪金或劳务报酬金额较大，但申报人数或税额为零或明显偏低。",
                "工资薪金或劳务报酬金额不低于 10,000 元，且申报人数小于等于 0 或个人所得税税额小于等于 0。",
                f"工资薪金/劳务报酬 {money_text(salary_amount)}；申报人数 {employee_count:.0f} 人；个税税额 {money_text(pit_tax_amount)}。",
                [
                    source_ref("pit_return", period, "salary_amount", "工资薪金/劳务报酬金额", salary_amount),
                    source_ref("pit_return", period, "employee_count", "申报人数", employee_count),
                    source_ref("pit_return", period, "pit_tax_amount", "个人所得税税额", pit_tax_amount),
                ],
            ))

    flagged_expenses = [
        row for row in analysis.expense_rows
        if any(token in safe_text(row.get("voucher_type") or row.get("text")).lower() for token in ["白条", "收据", "无票", "情况说明"])
    ]
    if flagged_expenses:
        amount = sum(to_amount(row.get("expense_amount") or row.get("amount")) for row in flagged_expenses)
        risks.append(make_risk(
            "白条入账",
            summarize_periods(analysis)[0],
            "费用或成本附件中存在白条、收据或无票凭证，票据合规性不足。",
            build_evidence([
                f"识别到 {len(flagged_expenses)} 笔疑似无票或白条凭证。",
                f"相关金额合计约 {amount:.2f} 元。",
            ]),
            0.78,
            {"flagged_expense_amount": amount, "flagged_rows": float(len(flagged_expenses))},
            "费用凭证合规性识别",
            "费用明细中出现“白条、收据、无票、情况说明”等凭证类型或文字描述。",
            "费用凭证文本命中无票或白条类关键词。",
            f"命中疑似无票/白条凭证 {len(flagged_expenses)} 笔，金额合计 {money_text(amount)}。",
            [
                source_ref("expense_detail", summarize_periods(analysis)[0], "voucher_type", "疑似无票凭证笔数", len(flagged_expenses)),
                source_ref("expense_detail", summarize_periods(analysis)[0], "expense_amount", "相关金额合计", amount),
            ],
        ))

    if analysis.sales_invoices or analysis.purchase_invoices:
        all_invoices = analysis.sales_invoices + analysis.purchase_invoices
        top_counterparty = Counter(item.counterparty or "未填写对象" for item in all_invoices).most_common(1)
        top_day = Counter(item.invoice_date or "未识别日期" for item in all_invoices).most_common(1)
        counterparty_share = top_counterparty[0][1] / len(all_invoices) if top_counterparty else 0.0
        day_share = top_day[0][1] / len(all_invoices) if top_day else 0.0
        item_diversity = len({item.item_name for item in all_invoices if item.item_name})
        if len(all_invoices) >= 5 and (counterparty_share >= 0.75 or day_share >= 0.6 or item_diversity <= 1):
            risks.append(make_risk(
                "变票",
                summarize_periods(analysis)[0],
                "发票开具或取得行为出现集中开具、对象高度集中或品名结构异常单一的特征。",
                build_evidence([
                    f"最集中交易对象占比约 {counterparty_share * 100:.0f}%。",
                    f"最集中开票日期占比约 {day_share * 100:.0f}%。",
                    f"识别到品名数量 {item_diversity} 个。",
                ]),
                0.74,
                {"counterparty_share_pct": counterparty_share * 100, "day_share_pct": day_share * 100, "item_diversity": float(item_diversity)},
                "发票集中度与品名结构识别",
                "发票交易对象、开票日期或品名结构呈现异常集中，可能存在变名开票或异常开票链条。",
                "发票数量不少于 5 张，且交易对象占比不低于 75%、开票日期占比不低于 60%，或品名数量小于等于 1 个。",
                f"最集中交易对象占比 {counterparty_share:.0%}；最集中开票日期占比 {day_share:.0%}；品名数量 {item_diversity} 个。",
                [
                    source_ref("invoice_pool", summarize_periods(analysis)[0], "counterparty_share", "最集中交易对象占比", f"{counterparty_share:.0%}"),
                    source_ref("invoice_pool", summarize_periods(analysis)[0], "day_share", "最集中开票日期占比", f"{day_share:.0%}"),
                    source_ref("invoice_pool", summarize_periods(analysis)[0], "item_diversity", "品名数量", item_diversity),
                ],
            ))

    unique_risks: list[dict[str, Any]] = []
    seen = set()
    for risk in risks:
        key = (risk["risk_type"], risk["period"])
        if key in seen:
            continue
        seen.add(key)
        unique_risks.append(risk)
    return unique_risks


def build_notice_payload(task: Task, analysis: NormalizedTaxAnalysis, risks: list[dict[str, Any]]) -> dict[str, Any]:
    company_name = analysis.company_name or "待补充企业名称"
    taxpayer_id = analysis.taxpayer_id or "待补充税号"
    return {
        "document_type": "tax_notice",
        "title": "税务事项通知书",
        "task_id": task.task_id,
        "task_name": task.name,
        "enterprise_name": company_name,
        "taxpayer_id": taxpayer_id,
        "generated_at": datetime.utcnow().isoformat(),
        "rectification_deadline": "收到通知后 5 个工作日内",
        "contact_person": "主管税务人员",
        "contact_phone": "请在系统配置中补充联系人电话",
        "issues": [
            {
                "risk_type": risk["risk_type"],
                "period": risk["period"],
                "issue": risk["issue"],
                "basis_data": risk["notice_basis_data"],
                "evidence": risk["evidence"],
                "rectify_advice": risk["rectify_advice"],
                "rule_name": risk["rule_name"],
                "trigger_reason": risk["trigger_reason"],
                "threshold_text": risk["threshold_text"],
                "calculation_text": risk["calculation_text"],
                "source_data_refs": risk["source_data_refs"],
            }
            for risk in risks
        ],
    }


def build_officer_report_payload(task: Task, analysis: NormalizedTaxAnalysis, risks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "document_type": "analysis_report",
        "title": "企业涉税风险分析报告",
        "task_id": task.task_id,
        "task_name": task.name,
        "enterprise_name": analysis.company_name or "待补充企业名称",
        "taxpayer_id": analysis.taxpayer_id or "待补充税号",
        "generated_at": datetime.utcnow().isoformat(),
        "risk_count": len(risks),
        "data_summary": {
            "periods": summarize_periods(analysis),
            "sales_invoice_count": len(analysis.sales_invoices),
            "purchase_invoice_count": len(analysis.purchase_invoices),
            "vat_return_periods": len(analysis.vat_returns),
            "cit_return_periods": len(analysis.cit_returns),
            "pit_return_periods": len(analysis.pit_returns),
            "financial_statement_periods": len(analysis.finance),
            "expense_rows": len(analysis.expense_rows),
            "data_warnings": analysis.data_warnings,
            "source_files": analysis.source_files,
        },
        "risks": [
            {
                "risk_type": risk["risk_type"],
                "severity": risk["severity"],
                "period": risk["period"],
                "issue": risk["issue"],
                "evidence": risk["evidence"],
                "verification_focus": risk["verification_focus"],
                "required_materials": risk["required_materials"],
                "judgment_rule": risk["judgment_rule"],
                "metrics": risk["metrics"],
                "confidence": risk["confidence"],
                "rule_name": risk["rule_name"],
                "trigger_reason": risk["trigger_reason"],
                "threshold_text": risk["threshold_text"],
                "calculation_text": risk["calculation_text"],
                "source_data_refs": risk["source_data_refs"],
            }
            for risk in risks
        ],
    }


def render_notice_text(payload: dict[str, Any]) -> str:
    lines = [
        payload["title"],
        f"税务机关: {payload.get('agency_name', '主管税务机关')}",
        f"文号: {payload.get('document_number', '系统自动生成')}",
        f"企业名称: {payload['enterprise_name']}",
        f"纳税人识别号: {payload['taxpayer_id']}",
        f"分析任务: {payload['task_name']} ({payload['task_id']})",
        f"整改期限: {payload['rectification_deadline']}",
        f"联系人: {payload['contact_person']}",
        f"联系电话: {payload['contact_phone']}",
        f"文书日期: {payload.get('document_date', '') or payload['generated_at'][:10]}",
        "",
        "请贵单位针对以下事项进行核实整改并反馈情况：",
    ]
    if not payload["issues"]:
        lines.append("1. 本次分析未识别出明确风险事项，但建议补充更完整的发票、申报和财务资料后再次分析。")
    for index, issue in enumerate(payload["issues"], start=1):
        lines.extend([
            f"{index}. 风险类型: {issue['risk_type']}",
            f"   涉及期间: {issue['period']}",
            f"   发现问题: {issue['issue']}",
            f"   规则名称: {issue.get('rule_name', '规则待补充')}",
            f"   触发原因: {issue.get('trigger_reason', issue['issue'])}",
            f"   涉及数据: {format_source_refs(issue.get('source_data_refs', []))}",
            f"   计算过程: {issue.get('calculation_text', '未生成计算说明')}",
            f"   判断阈值: {issue.get('threshold_text', '按申报、发票、财务资料一致性综合判断')}",
            f"   依据数据: {issue['basis_data']}",
            f"   证据要点: {'; '.join(issue['evidence']) or '—'}",
            f"   整改要求: {issue['rectify_advice']}",
        ])
    return "\n".join(lines)


def render_officer_report_text(payload: dict[str, Any]) -> str:
    lines = [
        payload["title"],
        f"税务机关: {payload.get('agency_name', '未填写')}",
        f"报告编号: {payload.get('document_number', payload['task_id'])}",
        f"企业名称: {payload['enterprise_name']}",
        f"纳税人识别号: {payload['taxpayer_id']}",
        f"分析任务: {payload['task_name']} ({payload['task_id']})",
        f"文书日期: {payload.get('document_date', '') or payload['generated_at'][:10]}",
        f"生成时间: {payload['generated_at']}",
        f"识别风险数: {payload['risk_count']}",
        "",
        "数据概况:",
        f"期间: {', '.join(payload['data_summary']['periods'])}",
        f"销项发票数: {payload['data_summary']['sales_invoice_count']}",
        f"进项发票数: {payload['data_summary']['purchase_invoice_count']}",
        f"增值税申报期间数: {payload['data_summary']['vat_return_periods']}",
        f"企业所得税期间数: {payload['data_summary']['cit_return_periods']}",
        f"个人所得税期间数: {payload['data_summary'].get('pit_return_periods', 0)}",
        f"财务报表期间数: {payload['data_summary']['financial_statement_periods']}",
        f"费用明细数: {payload['data_summary']['expense_rows']}",
        "",
        "风险明细:",
    ]
    if not payload["risks"]:
        lines.append("未识别出明确风险，当前更接近数据不足或资料尚不完整。")
    for index, risk in enumerate(payload["risks"], start=1):
        lines.extend([
            f"{index}. {risk['risk_type']} / {risk['severity']} / {risk['period']}",
            f"   问题描述: {risk['issue']}",
            f"   规则名称: {risk.get('rule_name', '规则待补充')}",
            f"   触发原因: {risk.get('trigger_reason', risk['issue'])}",
            f"   涉及数据: {format_source_refs(risk.get('source_data_refs', []))}",
            f"   计算过程: {risk.get('calculation_text', '未生成计算说明')}",
            f"   判断阈值: {risk.get('threshold_text', '按申报、发票、财务资料一致性综合判断')}",
            f"   证据: {'; '.join(risk['evidence']) or '—'}",
            f"   核查方向: {risk['verification_focus']}",
            f"   需调取资料: {'; '.join(risk['required_materials'])}",
            f"   判断标准: {risk['judgment_rule']}",
        ])
    if payload["data_summary"]["data_warnings"]:
        lines.extend(["", "数据提醒:"])
        lines.extend(f"- {item}" for item in payload["data_summary"]["data_warnings"])
    return "\n".join(lines)


def analyze_files(task: Task, files: list[FileRecord]) -> dict[str, Any]:
    analysis = NormalizedTaxAnalysis(source_files=[item.original_name for item in files])

    for file_record in files:
        rows, source_type = load_file_rows(file_record)
        kind = detect_dataset_kind(file_record, rows)
        if not rows:
            if source_type == "image":
                analysis.data_warnings.append(f"{file_record.original_name} 已作为图片/扫描件佐证留存，当前未自动 OCR，请通过补录表填写关键申报指标。")
            else:
                analysis.data_warnings.append(f"{file_record.original_name} 未读取到可分析数据。")
            continue

        if source_type == "text" and kind == "unknown":
            analysis.data_warnings.append(f"{file_record.original_name} 未识别为结构化税务资料，已降级为文本提示。")
            continue

        for row in rows:
            merge_company_context(analysis, row)
            period = normalize_period(row.get("period"))
            analysis.periods.add(period)

            if kind == "sales_invoice":
                append_invoice(analysis.sales_invoices, row)
            elif kind == "purchase_invoice":
                append_invoice(analysis.purchase_invoices, row)
            elif kind == "vat_return":
                analysis.vat_returns[period] = {
                    "sales_declared": to_amount(row.get("sales_declared") or row.get("amount") or row.get("revenue")),
                    "output_declared": to_amount(row.get("output_declared") or row.get("tax_amount")),
                    "input_declared": to_amount(row.get("input_declared")),
                }
            elif kind == "cit_return":
                analysis.cit_returns[period] = {
                    "revenue": to_amount(row.get("revenue") or row.get("amount")),
                    "cost": to_amount(row.get("cost")),
                    "profit": to_amount(row.get("profit")),
                    "taxable_income": to_amount(row.get("taxable_income")),
                }
            elif kind == "pit_return":
                analysis.pit_returns[period] = {
                    "salary_amount": to_amount(row.get("salary_amount") or row.get("amount")),
                    "employee_count": to_amount(row.get("employee_count")),
                    "pit_tax_amount": to_amount(row.get("pit_tax_amount") or row.get("tax_amount")),
                    "taxable_income": to_amount(row.get("taxable_income")),
                }
            elif kind == "financial_statement":
                analysis.finance[period] = {
                    "revenue": to_amount(row.get("revenue") or row.get("amount")),
                    "cost": to_amount(row.get("cost")),
                    "profit": to_amount(row.get("profit")),
                    "inventory_begin": to_amount(row.get("inventory_begin")),
                    "inventory_end": to_amount(row.get("inventory_end")),
                }
            elif kind == "expense_detail":
                analysis.expense_rows.append(row)
            else:
                if kind == "image_evidence" or source_type == "image":
                    analysis.data_warnings.append(f"{file_record.original_name} 已作为图片/扫描件佐证留存，当前未自动 OCR，请通过补录表填写关键申报指标。")
                else:
                    analysis.data_warnings.append(f"{file_record.original_name} 已读取但未归类，建议按申报/发票/财务模板上传。")
                break

    if not analysis.company_name and getattr(task, "company_name", ""):
        analysis.company_name = safe_text(getattr(task, "company_name", ""))
    if not analysis.taxpayer_id and getattr(task, "taxpayer_id", ""):
        analysis.taxpayer_id = safe_text(getattr(task, "taxpayer_id", ""))

    risks = detect_risks(analysis)
    risk_counter = Counter(item["risk_type"] for item in risks)
    summary_parts = [
        f"税务案头分析完成，共识别 {len(risks)} 项风险。",
        f"涉及期间：{', '.join(summarize_periods(analysis))}。",
    ]
    if risk_counter:
        summary_parts.append("风险分布：" + "，".join(f"{name} {count} 项" for name, count in risk_counter.items()) + "。")
    else:
        summary_parts.append("当前未识别出明确风险，建议补充更完整的增值税、企业所得税、个人所得税、财务报表和进销项发票数据后再次分析。")
    if analysis.data_warnings:
        summary_parts.append("数据提醒：" + "；".join(analysis.data_warnings[:3]))

    notice = build_notice_payload(task, analysis, risks)
    officer_report = build_officer_report_payload(task, analysis, risks)
    generated_records = [
        {
            "name": f"[{task.name}] {risk['risk_type']}",
            "category": "tax-risk",
            "tags": f"analysis,tax-risk,{risk['risk_type']},{risk['severity']}",
            "detail": f"{risk['period']}：{risk['issue']} 触发原因：{risk.get('trigger_reason', '')} 证据：{'；'.join(risk['evidence'])}",
        }
        for risk in risks
    ]

    return {
        "company_name": analysis.company_name,
        "taxpayer_id": analysis.taxpayer_id,
        "periods": summarize_periods(analysis),
        "risks": risks,
        "risk_count": len(risks),
        "material_gap_list": sorted({material for risk in risks for material in risk["required_materials"]}),
        "summary": "\n".join(summary_parts),
        "notice": notice,
        "analysis_report": officer_report,
        "generated_records": generated_records,
        "data_warnings": analysis.data_warnings,
    }


def profile_file(file_record: FileRecord) -> dict[str, Any]:
    rows, source_type = load_file_rows(file_record)
    dataset_kind = detect_dataset_kind(file_record, rows) if rows else ("image_evidence" if source_type == "image" else "empty")
    headers = list(rows[0].keys()) if rows else []
    required = REQUIRED_FIELDS.get(dataset_kind, [])
    missing = [field for field in required if field not in headers]
    warnings: list[str] = []
    if dataset_kind in {"unknown", "empty"}:
        warnings.append("未能稳定识别资料类型，请检查文件名和表头是否包含发票、申报、财务或费用类字段。")
    if missing:
        warnings.append("缺少建议字段：" + "、".join(missing))
    if source_type == "text":
        warnings.append("当前文件按文本降级读取，建议改为 CSV 或 XLSX 结构化表格。")
    if source_type == "image":
        warnings.append("当前图片/扫描件仅作为佐证留存，系统暂不自动 OCR，请使用补录表录入申报关键指标。")
    return {
        "dataset_kind": dataset_kind,
        "source_type": source_type,
        "row_count": len(rows),
        "headers": headers[:20],
        "required_fields": required,
        "missing_required_fields": missing,
        "warnings": warnings,
    }
