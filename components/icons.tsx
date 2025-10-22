import React from "react";
import {
  FaFileAlt, // LogoIcon - Script/File icon
  FaPen, // WriteIcon - Write/Edit icon
  FaArrowRight, // ContinueIcon - Continue/Next icon
  FaDownload, // ExportIcon - Download/Export icon
  FaRedo, // RewriteIcon - Rewrite/Refresh icon
  FaTrash, // DeleteIcon - Delete/Trash icon
  FaChevronUp, // ChevronUpIcon - Chevron up icon
  FaStar, // SparklesIcon - Star/Magic icon
  FaCopy, // CopyIcon - Copy icon
  FaTimes, // CloseIcon - Close/X icon
  FaSync, // RefreshIcon - Refresh/Sync icon
  FaComments, // DialogueIcon - Comments/Dialogue icon
  FaKey, // KeyIcon - Key icon
  FaSpinner, // SpinnerIcon - Loading spinner
} from "react-icons/fa";

// Logo Icon - Script/File icon
export const LogoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaFileAlt className="h-8 w-8 text-indigo-400" {...props} />
);

// Write Icon - Write/Edit icon
export const WriteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaPen className="h-5 w-5 mr-2" {...props} />
);

// Continue Icon - Continue/Next icon
export const ContinueIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaArrowRight className="h-5 w-5 mr-2" {...props} />
);

// Export Icon - Download/Export icon
export const ExportIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaDownload className="h-5 w-5 mr-2" {...props} />
);

// Rewrite Icon - Rewrite/Refresh icon
export const RewriteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaRedo className="h-5 w-5" {...props} />
);

// Delete Icon - Delete/Trash icon
export const DeleteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaTrash className="h-5 w-5" {...props} />
);

// Chevron Up Icon - Chevron up icon
export const ChevronUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaChevronUp className="h-5 w-5 ml-1" {...props} />
);

// Sparkles Icon - Star/Magic icon
export const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaStar className="h-5 w-5" {...props} />
);

// Spinner Icon - Loading spinner
export const SpinnerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaSpinner className="animate-spin h-5 w-5 text-white" {...props} />
);

// Copy Icon - Copy icon
export const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaCopy className="h-4 w-4" {...props} />
);

// Close Icon - Close/X icon
export const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaTimes className="h-6 w-6" {...props} />
);

// Refresh Icon - Refresh/Sync icon
export const RefreshIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaSync className="w-5 h-5" {...props} />
);

// Dialogue Icon - Comments/Dialogue icon
export const DialogueIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaComments className="h-5 w-5 mr-2" {...props} />
);

// Key Icon - Key icon
export const KeyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <FaKey className="h-5 w-5" {...props} />
);
