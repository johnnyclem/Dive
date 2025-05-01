import React from "react";
import {
  Modal as HeroModal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  ButtonProps,
  ModalProps as HeroModalProps,
} from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SoulsButton } from "./Button";

export interface FooterAction extends ButtonProps {
  label: string;
  onClick: () => void;
  closeModalOnClick?: boolean; // If true, calls onClose after onClick
  border?: string;
}

interface ModalProps extends Omit<HeroModalProps, 'children' | 'onClose'> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footerActions?: FooterAction[];
  hideCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerActions,
  hideCloseButton = false,
  size = "md", // Default size
  isDismissable = true, // Default dismissable behavior
  isKeyboardDismissDisabled = false,
  scrollBehavior = "inside", // Default scroll behavior
  placement = "center", // Default placement
  backdrop = "opaque", // Default backdrop
  ...restHeroModalProps // Pass remaining Hero UI Modal props
}) => {
  if (!isOpen) return null;

  const handleActionClick = (action: FooterAction) => {
    action.onClick();
    if (action.closeModalOnClick) {
      onClose();
    }
  };

  return (
    <HeroModal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()} // Trigger onClose when HeroModal requests close
      size={size}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      scrollBehavior={scrollBehavior}
      placement={placement}
      backdrop={backdrop}
      hideCloseButton={true} // We manage our own close button inside ModalHeader
      {...restHeroModalProps}
      classNames={{
        base: "border border-default-50 dark:border-default-50 bg-default-50 dark:bg-black", // Custom base styles
        // Add other custom classNames if needed (wrapper, backdrop, header, body, footer)
      }}
    >
      <ModalContent>
        {(modalOnClose) => ( // modalOnClose is provided by Hero UI, linked to dismiss actions
          <>
            <ModalHeader className="flex flex-col gap-1 text-lg font-semibold text-default-900 dark:text-default-50">
              {title}
              {!hideCloseButton && (
                <Button
                  isIconOnly
                  aria-label="Close modal"
                  variant="light"
                  className="absolute top-3 right-3 text-default-500 hover:text-default-700 dark:text-default-400 dark:hover:text-default-200"
                  onPress={onClose} // Use our onClose prop
                >
                  <XMarkIcon className="h-6 w-6" />
                </Button>
              )}
            </ModalHeader>
            <ModalBody className="text-default-700 dark:text-default-300">
              {children}
            </ModalBody>
            {footerActions && footerActions.length > 0 && (
              <ModalFooter>
                {footerActions.map(({ label, onClick, closeModalOnClick, color, variant, isLoading, isDisabled, border, ...otherActionProps }, index) => (
                  <SoulsButton
                    key={index}
                    color={color || (index === footerActions.length - 1 ? "primary" : "default")} // Default last button to primary
                    variant={variant}
                    isLoading={isLoading}
                    isDisabled={isDisabled}
                    onPress={() => handleActionClick({ label, onClick, closeModalOnClick, color, variant, isLoading, isDisabled, ...otherActionProps })}
                  >
                    {label}
                  </SoulsButton>
                ))}
              </ModalFooter>
            )}
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
};

export default Modal;