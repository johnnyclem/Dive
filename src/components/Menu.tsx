import {
  Button,
  Menu as FluentMenu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import {
  bundleIcon,
  PinFilled,
  PinRegular,
  PinOffFilled,
  PinOffRegular,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
  DocumentFolderRegular,
  DocumentFolderFilled,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);
const DocumentFolderIcon = bundleIcon(
  DocumentFolderFilled,
  DocumentFolderRegular,
);
const MoreHorizontalIcon = bundleIcon(
  MoreHorizontalFilled,
  MoreHorizontalRegular,
);

interface MenuProps {
  item: {
    id: string;
    pinedAt: number | null;
    name: string;
    memo: string;
    updatedAt: {
      value: string;
      timestamp: number;
    };
    numOfFiles: number;
  };
  onEdit: (id: string) => void;
  onManageFiles: (item: MenuProps['item']) => void;
  onDelete: (item: MenuProps['item']) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
}

export default function ActionMenu({
  item,
  onEdit,
  onManageFiles,
  onDelete,
  onPin,
  onUnpin,
}: MenuProps) {
  const { t } = useTranslation();

  return (
    <FluentMenu>
      <MenuTrigger disableButtonEnhancement>
        <Button 
          icon={<MoreHorizontalIcon />} 
          appearance="subtle"
          className="hover:bg-[var(--bg-ultraweak)] text-[var(--text)]"
        />
      </MenuTrigger>
      <MenuPopover className="bg-[var(--bg-medium)] shadow-lg rounded-lg border border-[var(--border-weak)]">
        <MenuList className="p-1">
          <MenuItem 
            icon={<EditIcon />} 
            onClick={() => onEdit(item.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-ultraweak)] rounded-md"
          >
            {t('Common.Edit')}
          </MenuItem>
          <MenuItem
            icon={<DocumentFolderIcon />}
            onClick={() => onManageFiles(item)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-ultraweak)] rounded-md"
          >
            {t('Knowledge.Action.ManageFiles')}
          </MenuItem>
          <MenuItem 
            icon={<DeleteIcon />} 
            onClick={() => onDelete(item)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-ultraweak)] rounded-md"
          >
            {t('Common.Delete')}
          </MenuItem>
          {item.pinedAt ? (
            <MenuItem 
              icon={<PinOffIcon />} 
              onClick={() => onUnpin(item.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-ultraweak)] rounded-md"
            >
              {t('Common.Unpin')}
            </MenuItem>
          ) : (
            <MenuItem 
              icon={<PinIcon />} 
              onClick={() => onPin(item.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-ultraweak)] rounded-md"
            >
              {t('Common.Pin')}
            </MenuItem>
          )}
        </MenuList>
      </MenuPopover>
    </FluentMenu>
  );
} 