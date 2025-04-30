import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/common/Modal';

const StoragePage = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // TODO: Implement Storage management UI (e.g., vector stores, document management)

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{t("storage.title")}</h1>
        {/* Add relevant actions (e.g., Add Source, Manage Stores) */}
      </header>

      {/* Placeholder content */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
        <p>{t("storage.placeholder")}</p>
        <button onClick={() => setIsModalOpen(true)}>Open Modal</button>
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Test"
        >
          <p>Test</p>
        </Modal>
        {/* List vector stores or data sources here */}
      </div>
    </div>
  );
};

export default StoragePage;