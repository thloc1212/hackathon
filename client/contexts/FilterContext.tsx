import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DateFilterValue } from '@/components/DateFilter';

interface FilterContextType {
  dateFilter: DateFilterValue;
  setDateFilter: (filter: DateFilterValue) => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ month: null, year: null });

  const contextValue: FilterContextType = {
    dateFilter,
    setDateFilter,
  };

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};