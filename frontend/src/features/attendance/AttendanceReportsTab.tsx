import { useMemo, useState } from "react";

import { isApiError } from "../../api/errors";
import type { AttendanceMonthlyReport, AttendancePeriodReport, AttendanceTeam } from "../../api/types";
import { formatMoney } from "../../domain/money";
import { useAttendanceMonthlyReport, useAttendancePeriodReport, useAttendancePeriods } from "./attendanceQueries";

type AttendanceReportsTabProps = {
  canMutate: boolean;
};

type ReportMode = "period" | "monthly";

function teamLabel(team: AttendanceTeam) {
  return team === "blow" ? "Tổ thổi" : "Tổ cắt";
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function PeriodReportTable({ report }: { report: AttendancePeriodReport }) {
  return (
    <div className="inventory-table-wrap attendance-table-wrap">
      <table className="data-table inventory-data-table attendance-data-table attendance-report-table">
        <thead>
          <tr>
            <th>Ngày</th>
            {report.employee_summaries.map((employee) => (
              <th key={`employee-${employee.employee_id}`} colSpan={report.detail_labels.length + 1}>
                {employee.display_name}
              </th>
            ))}
            <th>Tổng ngày</th>
          </tr>
          <tr>
            <th></th>
            {report.employee_summaries.flatMap((employee) => [
              ...report.detail_labels.map((label) => <th key={`${employee.employee_id}-${label}`}>{label}</th>),
              <th key={`${employee.employee_id}-total`}>Tổng</th>,
            ])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.work_date}>
              <td>{row.work_date}</td>
              {row.employee_values.flatMap((employeeValue) => [
                ...report.detail_labels.map((label) => (
                  <td key={`${row.work_date}-${employeeValue.employee_id}-${label}`}>{employeeValue.details[label] ?? ""}</td>
                )),
                <td key={`${row.work_date}-${employeeValue.employee_id}-total`}>{formatMoney(employeeValue.total_amount)}</td>,
              ])}
              <td>{formatMoney(row.day_total)}</td>
            </tr>
          ))}
          <tr className="attendance-report-total-row">
            <td>Tổng</td>
            {report.employee_summaries.flatMap((employee) => [
              ...report.detail_labels.map((label) => <td key={`summary-${employee.employee_id}-${label}`}></td>),
              <td key={`summary-${employee.employee_id}-total`}>{formatMoney(employee.total_amount)}</td>,
            ])}
            <td>{formatMoney(report.grand_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MonthlyReportTable({ report }: { report: AttendanceMonthlyReport }) {
  return (
    <div className="inventory-table-wrap attendance-table-wrap">
      <table className="data-table inventory-data-table attendance-data-table attendance-report-table">
        <thead>
          <tr>
            <th>Nhân viên</th>
            {report.detail_labels.map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>Ngày công có tiền</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.employee_id}>
              <td>{row.display_name}</td>
              {report.detail_labels.map((label) => (
                <td key={`${row.employee_id}-${label}`}>{row.details[label] ?? ""}</td>
              ))}
              <td>{row.paid_workdays}</td>
              <td>{formatMoney(row.total_amount)}</td>
            </tr>
          ))}
          <tr className="attendance-report-total-row">
            <td>Tổng</td>
            {report.detail_labels.map((label) => (
              <td key={`summary-${label}`}></td>
            ))}
            <td>{report.total_paid_workdays}</td>
            <td>{formatMoney(report.grand_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceReportsTab({ canMutate }: AttendanceReportsTabProps) {
  const [mode, setMode] = useState<ReportMode>("period");
  const [team, setTeam] = useState<AttendanceTeam>("blow");
  const [month, setMonth] = useState(currentMonthValue());
  const periodsQuery = useAttendancePeriods();
  const periods = periodsQuery.data ?? [];
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  const resolvedPeriodId = selectedPeriodId ?? periods[0]?.id ?? null;
  const periodReportQuery = useAttendancePeriodReport(team, mode === "period" ? resolvedPeriodId : null);
  const monthlyReportQuery = useAttendanceMonthlyReport(team, month);

  const summaryText = useMemo(() => {
    if (mode === "period" && periodReportQuery.data) {
      return `Tổng kỳ: ${formatMoney(periodReportQuery.data.grand_total)} · Ngày công có tiền: ${periodReportQuery.data.total_paid_workdays}`;
    }
    if (mode === "monthly" && monthlyReportQuery.data) {
      return `Tổng tháng: ${formatMoney(monthlyReportQuery.data.grand_total)} · Ngày công có tiền: ${monthlyReportQuery.data.total_paid_workdays}`;
    }
    return null;
  }, [mode, monthlyReportQuery.data, periodReportQuery.data]);

  const activeError = mode === "period" ? periodReportQuery.error : monthlyReportQuery.error;
  const isLoading = mode === "period" ? periodReportQuery.isLoading : monthlyReportQuery.isLoading;

  return (
    <div className="attendance-tab-content">
      <div className="attendance-control-strip">
        <label className="attendance-field">
          Chế độ báo cáo
          <select aria-label="Chế độ báo cáo" value={mode} onChange={(event) => setMode(event.target.value as ReportMode)}>
            <option value="period">Kỳ 10 ngày</option>
            <option value="monthly">Tháng</option>
          </select>
        </label>
        <label className="attendance-field">
          Tổ
          <select aria-label="Tổ báo cáo" value={team} onChange={(event) => setTeam(event.target.value as AttendanceTeam)}>
            <option value="blow">{teamLabel("blow")}</option>
            <option value="cut">{teamLabel("cut")}</option>
          </select>
        </label>
        {mode === "period" ? (
          <label className="attendance-field">
            Kỳ 10 ngày
            <select
              aria-label="Kỳ 10 ngày"
              value={resolvedPeriodId ?? ""}
              onChange={(event) => setSelectedPeriodId(Number(event.target.value))}
              disabled={periods.length === 0}
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.start_date} → {period.end_date}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="attendance-field">
            Tháng
            <input aria-label="Tháng báo cáo" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        )}
        {!canMutate ? <p className="inventory-subtext">Chế độ chỉ xem báo cáo.</p> : null}
      </div>

      {summaryText ? <p className="state-message">{summaryText}</p> : null}
      {isLoading ? <p className="state-message">Đang tải báo cáo chấm công...</p> : null}
      {activeError ? (
        <p className="state-message error-message">
          {isApiError(activeError) ? activeError.message : "Không thể tải báo cáo chấm công."}
        </p>
      ) : null}

      {mode === "period" && periodReportQuery.data ? <PeriodReportTable report={periodReportQuery.data} /> : null}
      {mode === "monthly" && monthlyReportQuery.data ? <MonthlyReportTable report={monthlyReportQuery.data} /> : null}
    </div>
  );
}
