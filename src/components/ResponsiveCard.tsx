import React from 'react';

interface ResponsiveCardProps {
  title: string;
  content: string;
  icon?: React.ReactNode;
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({ title, content, icon }) => {
  return (
    <div className="
      min-w-[50px] 
      w-full 
      max-w-2xl 
      mx-auto 
      bg-white 
      dark:bg-gray-800 
      rounded-lg 
      shadow-md 
      p-4 
      sm:p-6 
      md:p-8 
      transition-all 
      duration-300 
      hover:shadow-lg
    ">
      <div className="
        flex 
        flex-col 
        sm:flex-row 
        items-start 
        sm:items-center 
        gap-4 
        sm:gap-6
      ">
        {icon && (
          <div className="
            min-w-[40px] 
            w-10 
            h-10 
            flex 
            items-center 
            justify-center 
            bg-blue-100 
            dark:bg-blue-900 
            rounded-full
          ">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h3 className="
            text-lg 
            sm:text-xl 
            md:text-2xl 
            font-semibold 
            text-gray-900 
            dark:text-white 
            mb-2
          ">
            {title}
          </h3>
          <p className="
            text-sm 
            sm:text-base 
            text-gray-600 
            dark:text-gray-300
          ">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveCard; 