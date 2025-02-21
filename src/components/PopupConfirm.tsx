import PopupWindow from "./PopupWindow";
import { useTranslation } from "react-i18next";

type TPopupConfirmProps = {
	title?: string
	children?: React.ReactNode
	zIndex?: number,
	className?: string,
	isNoBorder?: boolean,
	showClose?: boolean,
	onClickOutside?: () => void,
	onConfirm?: () => void,
	onConfirmText?: string | React.ReactNode,
	onConfirmDisabled?: boolean,
	onCancel?: () => void,
	onCancelText?: string | React.ReactNode,
	footerHint?: React.ReactNode | string,
	footerType?: "center" | "flex-end",
}
export default function PopupConfirm({ title, children, zIndex, className, isNoBorder, showClose, onClickOutside, onConfirm, onConfirmText, onConfirmDisabled, onCancel, onCancelText, footerHint, footerType }: TPopupConfirmProps) {
	const { t } = useTranslation();

	return (
		<PopupWindow onClickOutside={onClickOutside} zIndex={zIndex}>
			<div className={`popup-confirm ${isNoBorder ? "no-border" : ""} ${className}`}>
				{showClose && (
					<div className="close-btn" onClick={onClickOutside}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</div>
				)}
				{title &&
					<div className="popup-confirm-header">
						<h3>{title}</h3>
					</div>
				}
				{children &&
					<div className="popup-confirm-content">
						{children}
					</div>
				}
				<div className={`popup-confirm-footer ${footerHint ? "space-between" : footerType}`}>
					{footerHint &&
						<div className="popup-confirm-footer-hint">
							{footerHint}
						</div>
					}
					<div className="popup-confirm-footer-btn">
						{onCancel &&
							<button
								className="cancel-btn"
								onClick={onCancel}
							>
								{onCancelText || t('cancel')}
							</button>
						}
						{onConfirm &&
							<button
								className="confirm-btn"
								onClick={onConfirm}
								disabled={onConfirmDisabled}
							>
								{onConfirmText || t('confirm')}
							</button>
						}
					</div>
				</div>
			</div>
		</PopupWindow>
	)
}
