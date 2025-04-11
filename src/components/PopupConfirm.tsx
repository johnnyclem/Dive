import React from 'react';

interface PopupConfirmProps {
	isVisible: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	footerContent?: React.ReactNode;
	footerLayout?: 'default' | 'space-between' | 'center';
	noBorder?: boolean;
	className?: string;
}

export const PopupConfirm: React.FC<PopupConfirmProps> = ({
	isVisible,
	onClose,
	title,
	children,
	footerContent,
	footerLayout = 'default',
	noBorder = false,
	className = '',
}) => {
	if (!isVisible) return null;

	return (
		<div
			className={`
				flex flex-col bg-bg rounded-lg shadow-[0_8px_32px_var(--shadow-modal)]
				fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
				min-w-[400px] min-h-[200px] max-w-[95vw] max-h-[85vh] overflow-hidden
				${className}
			`}
		>
			<button
				onClick={onClose}
				className="absolute top-0 right-0 p-2 bg-transparent border-none cursor-pointer
						 rounded-full flex items-center justify-center hover:bg-bg-op-dark-ultraweak"
			>
				<svg
					className="w-5 h-5 fill-current"
					viewBox="0 0 24 24"
				>
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
				</svg>
			</button>

			{title && (
				<div
					className={`
						flex flex-1 justify-center items-center p-4 text-base font-bold
						${noBorder ? 'border-none bg-transparent' : 'border-b border-border-weak bg-bg-medium'}
					`}
				>
					{title}
				</div>
			)}

			<div className="flex-1 flex justify-center items-center p-4">
				{children}
			</div>

			{footerContent && (
				<div
					className={`
						p-5 flex gap-2
						${noBorder ? 'border-none' : 'border-t border-border-weak'}
						${footerLayout === 'space-between' ? 'justify-between' : ''}
						${footerLayout === 'center' ? 'justify-center' : 'justify-end'}
					`}
				>
					{footerContent}
				</div>
			)}
		</div>
	);
};

export const PopupConfirmButton: React.FC<{
	onClick: () => void;
	variant: 'cancel' | 'confirm';
	disabled?: boolean;
	children: React.ReactNode;
	className?: string;
}> = ({ onClick, variant, disabled = false, children, className = '' }) => {
	const baseClasses = 'h-10 leading-10 px-4 rounded-lg transition-all duration-200';
	const variantClasses = variant === 'cancel'
		? 'bg-bg-cancel shadow-[0_3px_7px_var(--shadow-btn-cancel)] hover:bg-bg-hover-cancel hover:shadow-none'
		: 'bg-bg-pri-green text-text-light shadow-[0_3px_7px_var(--shadow-btn-confirm)] hover:bg-bg-hover-green hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bg-pri-green disabled:hover:shadow-none';

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`${baseClasses} ${variantClasses} ${className}`}
		>
			{children}
		</button>
	);
};

export default PopupConfirm;
