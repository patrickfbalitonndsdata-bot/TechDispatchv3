import React from "react";
import { Mail, Clock, Settings, History, Sparkles, FileText, ChevronDown, CheckCircle2, Play } from "lucide-react";
import { SAMPLE_DATASETS, SampleDataset } from "../utils/sampleData";
import { AutomationConfig } from "../types";

interface NavbarProps {
  onLoadSample: (sample: SampleDataset) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  activeDatasetName?: string;
  totalOrdersCount: number;
  techniciansCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLoadSample,
  onOpenSettings,
  onOpenHistory,
  activeDatasetName,
  totalOrdersCount,
  techniciansCount,
}) => {
  const [sampleMenuOpen, setSampleMenuOpen] = React.useState(false);

  return (
    <header className="bg-white border-b border-zinc-200 text-zinc-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-tight text-zinc-900">TechDispatch</span>
                <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200">
                  Outlook Edition
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">Weekly Install &amp; Camera Schedule Generator</p>
            </div>
          </div>

          {/* Center Stats */}
          <div className="hidden md:flex items-center space-x-2.5">
            {totalOrdersCount > 0 && (
              <div className="text-xs text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 font-medium">
                <span className="text-zinc-900 font-semibold">{totalOrdersCount}</span> Total Jobs &bull;{" "}
                <span className="text-zinc-900 font-semibold">{techniciansCount}</span> Field Technicians
              </div>
            )}
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Sample Datasets Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
                className="flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg border border-zinc-200 transition shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Load Sample CSV</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {sampleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSampleMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 py-1.5 divide-y divide-zinc-100">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Select Industry Template
                    </div>
                    {SAMPLE_DATASETS.map((sample) => (
                      <button
                        key={sample.id}
                        onClick={() => {
                          onLoadSample(sample);
                          setSampleMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition flex flex-col space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-900">{sample.name}</span>
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                            {sample.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 line-clamp-1">{sample.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Branding & Template Settings */}
            <button
              onClick={onOpenSettings}
              title="Branding & Outlook Template Settings"
              className="flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg border border-zinc-200 transition shadow-xs"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
