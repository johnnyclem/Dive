import PopupWindow from "./PopupWindow";
import { useTranslation } from "react-i18next";

type TPopupConfirmProps = {
	title: string
	children: React.ReactNode
	zIndex?: number,
	showClose?: boolean,
	onClickOutside?: () => void,
	onConfirm?: () => void,
	onConfirmText?: string,
	onCancel?: () => void,
	onCancelText?: string,
	footerHint?: React.ReactNode | string,
}
export default function PopupConfirm({ title, children, zIndex, showClose, onClickOutside, onConfirm, onConfirmText, onCancel, onCancelText, footerHint }: TPopupConfirmProps) {
	const { t } = useTranslation();

	return (
		<PopupWindow onClickOutside={onClickOutside} zIndex={zIndex}>
			<div className="popup-confirm">
				<div className="popup-confirm-header">
					<h3>{title}</h3>
					{showClose && (
						<div className="close-btn" onClick={onClickOutside}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</div>
					)}
				</div>
				<div className="popup-confirm-content">
					{children}
				</div>
				<div className={`popup-confirm-footer ${footerHint ? "space-between" : ""}`}>
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
