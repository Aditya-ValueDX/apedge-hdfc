import {
    Database,
    FileCheck,
    FileText,
    Layers,
    Package,
    UploadIcon
} from "lucide-react";

export const getTabIconComponent = (tabName) => {
    const name = tabName.toLowerCase();

    if (name.includes("po")) return FileText;
    if (name.includes("quantity")) return Package;
    if (name.includes("data") || name.includes("repository")) return Database;
    if (name.includes("verify")) return FileCheck;
    if (name.includes("upload")) return UploadIcon;

    return Layers; // default
};
