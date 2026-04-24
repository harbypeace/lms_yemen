import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface DynamicDropdownProps {
  type: 'users' | 'courses' | 'activities' | 'activity-types';
  value: string;
  onChange: (value: string, item: any) => void;
  placeholder?: string;
  filterParams?: Record<string, string | undefined>;
  displayFormat?: (item: any) => string;
  valueKey?: string;
  className?: string;
}

export const DynamicDropdown: React.FC<DynamicDropdownProps> = ({
  type,
  value,
  onChange,
  placeholder = 'Search and select...',
  filterParams = {},
  displayFormat,
  valueKey = 'id',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // default display format
  const renderDisplay = (item: any) => {
    if (!item) return '';
    if (displayFormat) return displayFormat(item);
    if (type === 'users') return `${item.full_name || item.username || 'Unknown'} (${item.username})`;
    if (type === 'courses') return item.title;
    if (type === 'activities') return item.title;
    if (type === 'activity-types') return item.name;
    return item.id;
  };

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch options when search or filter changes
  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        Object.entries(filterParams).forEach(([k, v]) => {
          if (v) params.append(k, v as string);
        });

        const res = await fetch(`/api/search/${type}?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        const result = await res.json();
        
        if (result.success && isMounted) {
          setOptions(result.data || []);
          
          // if selected item is not loaded but we have a value, try to derive it from the fetched list
          if (value && !selectedItem && result.data) {
            const found = result.data.find((o: any) => o[valueKey] === value);
            if (found) setSelectedItem(found);
          }
        }
      } catch (err) {
        console.error('Error fetching dynamic options:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Debounce the fetching
    const timeoutId = setTimeout(() => {
      fetchOptions();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [search, type, JSON.stringify(filterParams), value, valueKey]);

  // When value prop is cleared externally, also clear selectedItem
  useEffect(() => {
    if (!value && selectedItem) {
      setSelectedItem(null);
    }
  }, [value]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(true)}
        className="w-full relative flex items-center justify-between pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all cursor-text min-h-[46px]"
      >
        {!isOpen && !value && <span className="text-slate-400 text-sm truncate">{placeholder}</span>}
        {!isOpen && value && selectedItem && <span className="text-slate-800 text-sm truncate font-medium">{renderDisplay(selectedItem)}</span>}
        {!isOpen && value && !selectedItem && <span className="text-slate-800 text-sm truncate font-medium">{value}</span>}

        {isOpen && (
          <div className="flex items-center w-full gap-2 text-slate-800">
            <Search className="w-4 h-4 text-slate-400 shrinks-0" />
            <input
              type="text"
              autoFocus
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 p-0"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <div className="absolute right-3 flex items-center gap-1">
            {value && !isOpen && (
                <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onChange('', null); 
                      setSelectedItem(null); 
                      setSearch(''); 
                    }}
                    className="p-1 hover:bg-slate-200 rounded-full text-slate-400 focus:outline-none"
                    title="Clear selection"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl py-2 max-h-60 overflow-y-auto outline-none focus:outline-none">
          {loading && options.length === 0 ? (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          ) : options.length > 0 ? (
            options.map((item, idx) => (
              <button
                key={`${item[valueKey]}-${idx}`}
                type="button"
                onClick={() => {
                  onChange(item[valueKey], item);
                  setSelectedItem(item);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === item[valueKey] 
                    ? 'bg-indigo-50 text-indigo-700 font-medium border-l-2 border-indigo-500' 
                    : 'text-slate-700 hover:bg-slate-50 border-l-2 border-transparent'
                }`}
              >
                {renderDisplay(item)}
              </button>
            ))
          ) : (
            <div className="p-4 text-center">
               <p className="text-sm text-slate-500 mb-1">No results found.</p>
               <p className="text-xs text-slate-400">Try checking spelling or generic terms.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
