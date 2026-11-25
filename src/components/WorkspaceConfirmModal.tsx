import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { WorkspaceConfirmAction } from '../types';

interface WorkspaceConfirmModalProps {
  action: WorkspaceConfirmAction | null;
  isBusy: boolean;
  onClose: () => void;
}

export const WorkspaceConfirmModal: React.FC<WorkspaceConfirmModalProps> = ({
  action,
  isBusy,
  onClose,
}) => {
  if (!action) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#11241D]/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#FCFDFB] border border-[#DCE6DF] shadow-[0_20px_50px_-12px_rgba(17,36,29,0.2)] overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#DCE6DF]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E3F5EB] border border-[#B7E4C7] text-[#135D3B]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3
              id="workspace-confirm-title"
              className="text-base font-semibold tracking-tight text-[#11241D]"
            >
              {action.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg p-1.5 text-[#4A6358] hover:text-[#11241D] hover:bg-[#E6F0EA] transition-colors"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-[#4A6358] leading-relaxed">{action.description}</p>
          {action.details.length > 0 && (
            <ul className="space-y-1.5 rounded-xl bg-[#F4F7F4] border border-[#DCE6DF] p-3.5 text-xs text-[#11241D]">
              {action.details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1B5E43] shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-[#F4F7F4] border-t border-[#DCE6DF]">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 text-xs font-medium text-[#11241D] bg-[#FCFDFB] border border-[#CBD8D0] rounded-xl hover:bg-[#E6F0EA] transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={action.onConfirm}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B5E43] rounded-xl hover:bg-[#144733] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Check className="h-3.5 w-3.5" />
            {isBusy ? 'Processing...' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
