import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';

const SettingsPage = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // This component acts as a layout/hub for settings sub-pages.
  // It could include shared settings elements or navigation.

  const navItems = [
    { path: "/settings/model", label: t("sidebar.models") },
    { path: "/settings/system", label: t("sidebar.system") },
    // Add other settings sections here
  ];

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [underlineStyle, setUnderlineStyle] = useState<React.CSSProperties>({});
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const navRef = useRef<HTMLUListElement>(null);

  const activeIndex = navItems.findIndex(item => item.path === location.pathname);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, navItems.length);
  }, [navItems.length]);

  useEffect(() => {
    const targetIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;
    const targetRef = itemRefs.current[targetIndex];
    const navElement = navRef.current;

    if (targetRef && navElement) {
      const navRect = navElement.getBoundingClientRect();
      const targetRect = targetRef.getBoundingClientRect();

      setUnderlineStyle({
        left: `${targetRect.left - navRect.left}px`,
        width: `${targetRect.width}px`,
        opacity: 1,
      });
    } else if (activeIndex === -1) {
      setUnderlineStyle({
        opacity: 0,
        width: '0px',
      });
    }
  }, [hoveredIndex, activeIndex]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t("settings.title")}</h1>
      </header>

      <nav className="mb-6 relative">
        <ul className="flex gap-4 border-b border-border border-transparent" ref={navRef}>
          {navItems.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={item.path}
                ref={(el) => (itemRefs.current[index] = el)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative"
              >
                <Link
                  to={item.path}
                  className={`
                    pb-2 block transition-colors duration-150
                    ${isActive ? 'text-primary' : 'text-text-secondary hover:text-primary'}
                  `}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          className="absolute bottom-0 h-[2px] bg-primary transition-all duration-300 ease-in-out"
          style={underlineStyle}
        />
      </nav>

      {/* Render the child route component */}
      <Outlet />
    </div>
  );
};

export default SettingsPage;