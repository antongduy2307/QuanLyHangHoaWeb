import { FormEvent, useState } from "react";

import { isApiError } from "../../api/errors";
import type { AttendanceEmployee, AttendanceEmployeeCreatePayload, AttendanceEmployeeUpdatePayload, AttendanceTeam } from "../../api/types";

type AttendanceEmployeeDialogProps = {
  employee?: AttendanceEmployee | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: AttendanceEmployeeCreatePayload | AttendanceEmployeeUpdatePayload) => Promise<void>;
};

export function AttendanceEmployeeDialog({ employee, isSubmitting, onClose, onSubmit }: AttendanceEmployeeDialogProps) {
  const [displayName, setDisplayName] = useState(employee?.display_name ?? "");
  const [team, setTeam] = useState<AttendanceTeam>(employee?.team ?? "blow");
  const [isActive, setIsActive] = useState(employee?.is_active ?? true);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ displayName?: string }>({});
  const isEditMode = Boolean(employee);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { displayName?: string } = {};
    if (!displayName.trim()) {
      nextErrors.displayName = "Tên nhân viên là bắt buộc.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFormError(null);
    try {
      await onSubmit({
        display_name: displayName.trim(),
        team,
        is_active: isActive,
      });
      onClose();
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Không thể lưu nhân viên.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card customer-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-employee-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="customer-modal-card__header">
          <div>
            <h3 id="attendance-employee-dialog-title">{isEditMode ? "Sửa nhân viên" : "Thêm nhân viên"}</h3>
            <p>{isEditMode ? "Cập nhật thông tin nhân viên chấm công." : "Tạo nhân viên mới cho chấm công."}</p>
          </div>
          <button className="inventory-ghost-button" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form className="customer-modal-form" onSubmit={handleSubmit}>
          <div className="customer-modal-form__grid">
            <label>
              Tên nhân viên
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              {fieldErrors.displayName ? <span className="field-error">{fieldErrors.displayName}</span> : null}
            </label>
            <label>
              Tổ
              <select value={team} onChange={(event) => setTeam(event.target.value as AttendanceTeam)}>
                <option value="blow">Tổ thổi</option>
                <option value="cut">Tổ cắt</option>
              </select>
            </label>
            <label className="attendance-employee-dialog__checkbox">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              <span>Đang sử dụng</span>
            </label>
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="form-actions">
            <button className="secondary-link" type="button" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu" : isEditMode ? "Lưu nhân viên" : "Tạo nhân viên"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
