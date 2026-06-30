import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Sun,
  Home,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Check,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Save,
  FolderOpen,
  Settings,
  X,
  GripVertical,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize
} from "lucide-react";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import TextareaAutosize from "react-textarea-autosize";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { generateProductionManual } from "./services/geminiService";
import { ProductionManual, Annotation, Environment, PageDef } from "./types";
import { STANDARD_MATERIALS, DEFAULT_KNOWLEDGE_BASE } from "./constants";
import Chatbot from "./components/Chatbot";
import { PinModal } from "./components/PinModal";

export default function App() {
  const [step, setStep] = useState<number>(1);
  const [renderImages, setRenderImages] = useState<string[]>([]);
  const [techDrawings, setTechDrawings] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<Environment>("indoor");
  const [loading, setLoading] = useState<boolean>(false);
  const [manual, setManual] = useState<ProductionManual | null>(null);
  const [pages, setPages] = useState<PageDef[]>([]);
  const [bomRowHeight, setBomRowHeight] = useState<"compact" | "normal" | "relaxed">("compact");
  const [error, setError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<string>(() => {
    const saved = localStorage.getItem("booth_knowledge_base");
    return saved || DEFAULT_KNOWLEDGE_BASE;
  });
  const [customMaterials, setCustomMaterials] = useState<string[]>(() => {
    const saved = localStorage.getItem("booth_materials");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return STANDARD_MATERIALS;
  });
  const [newMaterial, setNewMaterial] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const executeProtectedAction = (action: () => void) => {
    if (isUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPinModal(true);
    }
  };

  const handlePinSuccess = () => {
    setIsUnlocked(true);
    setShowPinModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    localStorage.setItem("booth_materials", JSON.stringify(customMaterials));
  }, [customMaterials]);

  const handleAddMaterial = () => {
    if (newMaterial.trim() && !customMaterials.includes(newMaterial.trim())) {
      setCustomMaterials([...customMaterials, newMaterial.trim()]);
      setNewMaterial("");
    }
  };

  const handleEditStart = (index: number, val: string) => {
    setEditingIndex(index);
    setEditingValue(val);
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingIndex(null);
      return;
    }

    // Prevent overriding with duplicate
    const isDuplicate = customMaterials.some(
      (m, idx) => m === trimmed && idx !== editingIndex,
    );
    if (isDuplicate) {
      alert("Vật liệu này đã tồn tại trong danh sách!");
    } else {
      const newMats = [...customMaterials];
      newMats[editingIndex] = trimmed;
      setCustomMaterials(newMats);
    }
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleRemoveMaterial = (mat: string) => {
    setCustomMaterials(customMaterials.filter((m) => m !== mat));
  };

  const handleResetMaterials = () => {
    if (
      confirm("Khôi phục về danh sách gốc? Các vật liệu bạn thêm sẽ bị xóa.")
    ) {
      setCustomMaterials(STANDARD_MATERIALS);
    }
  };

  const handleExportMaterials = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(customMaterials, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "library_materials.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportMaterials = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (
          Array.isArray(json) &&
          json.every((item) => typeof item === "string")
        ) {
          if (confirm("Ghi đè thư viện hiện tại bằng danh sách từ file?")) {
            setCustomMaterials(json);
          }
        } else {
          alert("File dữ liệu không hợp lệ. Yêu cầu mảng chuỗi (array of strings).");
        }
      } catch (err) {
        alert("Lỗi khi đọc file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const manualRef = useRef<HTMLDivElement>(null);

  const handleSaveProject = () => {
    if (!manual) return;
    const projectData = {
      renderImages,
      techDrawings,
      environment,
      manual,
      pages,
      bomRowHeight,
      version: "1.0",
      timestamp: new Date().toISOString(),
    };

    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(projectData));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute(
        "download",
        `booth_project_${Date.now()}.json`,
      );
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      console.error("Lỗi khi lưu dự án:", err);
      alert("Không thể lưu dự án. Vui lòng thử lại.");
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.renderImages && json.manual) {
          setRenderImages(json.renderImages || []);
          setTechDrawings(json.techDrawings || []);
          setEnvironment(json.environment || "indoor");
          setManual(json.manual);
          setPages(json.pages || []);
          setBomRowHeight(json.bomRowHeight || "compact");
          setStep(3);
        } else {
          alert("File dự án không hợp lệ hoặc bị lỗi định dạng.");
        }
      } catch (err) {
        console.error("Lỗi khi đọc file dự án:", err);
        alert("Lỗi khi đọc file dự án.");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = "";
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newImages: string[] = [];
      let loaded = 0;
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push(reader.result as string);
          loaded++;
          if (loaded === files.length) {
            setter((prev) => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input value so the same file can be selected again if needed
    e.target.value = "";
  };

  const removeImage = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (renderImages.length === 0) {
      setError("Vui lòng tải lên hình ảnh Render 3D.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateProductionManual(
        renderImages,
        techDrawings,
        environment,
        customMaterials,
        knowledgeBase
      );

      setManual(result);

      const initialPages: PageDef[] = [];

      const RENDER_ITEMS_PER_PAGE = 4;
      const numRenderPages =
        Math.ceil(result.annotations.length / RENDER_ITEMS_PER_PAGE) || 1;

      for (let i = 0; i < numRenderPages; i++) {
        const ids = result.annotations
          .slice(i * RENDER_ITEMS_PER_PAGE, (i + 1) * RENDER_ITEMS_PER_PAGE)
          .map((a) => a.id);
        initialPages.push({
          id: `page-render-${i}`,
          type: "COVER_AND_RENDER",
          title:
            i === 0
              ? "Bản vẽ chỉ định (Annotated Render)"
              : "Bản vẽ chỉ định (Tiếp theo)",
          annotationIds: ids,
        });
      }

      techDrawings.forEach((_, idx) => {
        initialPages.push({
          id: `page-tech-${idx}`,
          type: "TECH",
          title: `Bản vẽ kỹ thuật ${idx + 1}`,
          techIndex: idx,
        });
      });

      const BOM_ITEMS_PER_PAGE = 5;
      const numBomPages =
        Math.ceil(result.annotations.length / BOM_ITEMS_PER_PAGE) || 1;
      for (let i = 0; i < numBomPages; i++) {
        const ids = result.annotations
          .slice(i * BOM_ITEMS_PER_PAGE, (i + 1) * BOM_ITEMS_PER_PAGE)
          .map((a) => a.id);
        initialPages.push({
          id: `page-bom-${i}`,
          type: "BOM",
          title:
            i === 0
              ? "Bảng vật liệu & Quy cách (BOM)"
              : "Bảng vật liệu & Quy cách (Tiếp theo)",
          annotationIds: ids,
        });
      }

      initialPages.push({
        id: "page-tech-specs",
        type: "TECH_SPECS",
        title: "Quy cách sản xuất tiêu chuẩn",
      });

      initialPages.push({
        id: "page-notes",
        type: "NOTES",
        title: "Lưu ý chung & An toàn",
      });

      setPages(initialPages);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!manual) return;
    try {
      const data = manual.annotations.map((ann, index) => ({
        STT: index + 1,
        "Hạng Mục": ann.label,
        "Số Lượng": ann.quantity || 1,
        "Kích Thước": ann.spec || "",
        "Quy Cách & Vật Liệu": ann.description || "",
        "Ghi Chú": ann.note || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "BOM");

      const cols = [
        { wch: 8 }, // STT
        { wch: 30 }, // Hạng Mục
        { wch: 12 }, // Số lượng
        { wch: 25 }, // Kích Thước
        { wch: 45 }, // Quy Cách & Vật Liệu
        { wch: 25 }, // Ghi chú
      ];
      worksheet["!cols"] = cols;

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:F1");
      
      const headerBorder = {
        top: { style: "thin", color: { rgb: "1E3A8A" } },
        bottom: { style: "thin", color: { rgb: "1E3A8A" } },
        left: { style: "thin", color: { rgb: "1E3A8A" } },
        right: { style: "thin", color: { rgb: "1E3A8A" } },
      };

      const cellBorder = {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      };

      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
        fill: { fgColor: { rgb: "3B82F6" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: headerBorder
      };

      const cellStyle = {
        font: { sz: 11, color: { rgb: "1F2937" } },
        alignment: { vertical: "center", wrapText: true },
        border: cellBorder
      };
      
      const centerStyle = {
        ...cellStyle,
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          
          if (R === 0) {
            worksheet[cellAddress].s = headerStyle;
          } else {
            if (C === 0 || C === 2) {
              worksheet[cellAddress].s = centerStyle;
            } else {
              worksheet[cellAddress].s = cellStyle;
            }
          }
        }
      }

      const rows = [{ hpt: 35 }]; // Header row height
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        rows.push({ hpt: 45 }); // Data rows height
      }
      worksheet["!rows"] = rows;

      XLSX.writeFile(workbook, "Booth_BOM.xlsx");
    } catch (err) {
      console.error("Lỗi khi tạo Excel:", err);
      alert("Không thể tạo file Excel.");
    }
  };

  const handleDownloadPDF = async () => {
    if (!manualRef.current) return;
    try {
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const pageElements = Array.from(
        manualRef.current.querySelectorAll(".printable-page"),
      );

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        const { scrollWidth, scrollHeight } = pageEl;
        const imgData = await toJpeg(pageEl, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: scrollWidth,
          height: scrollHeight,
          style: {
            boxShadow: "none",
            border: "none",
            borderRadius: "0",
            margin: "0",
          },
          filter: (node) => {
            if (node.classList && node.classList.contains("no-print")) {
              return false;
            }
            return true;
          },
        });

        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        let scaledWidth = pdfWidth;
        let scaledHeight = scaledWidth / ratio;

        if (scaledHeight > pageHeight) {
          scaledHeight = pageHeight;
          scaledWidth = scaledHeight * ratio;
        }

        if (i > 0) {
          pdf.addPage();
        }

        const xOffset = (pdfWidth - scaledWidth) / 2;
        const yOffset = (pageHeight - scaledHeight) / 2;

        pdf.addImage(imgData, "JPEG", xOffset, yOffset, scaledWidth, scaledHeight);
      }

      pdf.save("Booth_Production_Manual.pdf");
    } catch (err) {
      console.error("Lỗi khi tạo PDF:", err);
      alert("Không thể tạo PDF.");
    }
  };

  const resetApp = () => {
    setStep(1);
    setRenderImages([]);
    setTechDrawings([]);
    setManual(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              B
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-800 hidden sm:block">
              Bóc Tách Sản Xuất Booth
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => executeProtectedAction(() => setShowKnowledgeBase(true))}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
              title="Thư mục Kiến thức"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Kiến Thức</span>
            </button>
            <input
              type="file"
              accept=".json"
              id="load-project"
              ref={fileInputRef}
              className="hidden"
              onChange={handleLoadProject}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Mở Dự Án</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              title="Cài Đặt Thư Viện Vật Liệu"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Cài Đặt</span>
            </button>

            {step === 3 && (
              <>
                <button
                  onClick={handleSaveProject}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Lưu Dự Án</span>
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button
                  onClick={resetApp}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Tạo Mới</span>
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden lg:inline">Tải Excel</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden lg:inline">Tải PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 1 && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Tải lên tài liệu thiết kế
              </h2>
              <p className="text-slate-500">
                Cung cấp hình ảnh render và bản vẽ kỹ thuật để bắt đầu bóc tách.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Render Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Hình ảnh Render 3D <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${renderImages.length > 0 ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 bg-white"}`}
                  >
                    {renderImages.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4 justify-center">
                          {renderImages.map((img, idx) => (
                            <div key={idx} className="relative group/item">
                              <img
                                src={img}
                                alt={`Render preview ${idx + 1}`}
                                className="h-24 object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                              />
                              <button
                                onClick={() =>
                                  removeImage(idx, setRenderImages)
                                }
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                title="Xóa ảnh"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="relative inline-block">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) =>
                              handleImageUpload(e, setRenderImages)
                            }
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 justify-center w-full">
                            <Plus className="w-4 h-4" /> Thêm ảnh khác
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-full w-full flex flex-col items-center justify-center py-4">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            handleImageUpload(e, setRenderImages)
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-blue-100 transition-colors mb-4">
                          <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Kéo thả hoặc nhấn để tải lên
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            PNG, JPG, WEBP (Tối đa 5MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tech Drawing Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Bản vẽ Kích thước (Tùy chọn)
                </label>
                <div className="relative group">
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors h-full flex flex-col items-center justify-center ${techDrawings.length > 0 ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 bg-white"}`}
                  >
                    {techDrawings.length > 0 ? (
                      <div className="space-y-4 w-full">
                        <div className="flex flex-wrap gap-4 justify-center">
                          {techDrawings.map((doc, idx) => (
                            <div key={idx} className="relative group/item">
                              {doc.startsWith("data:image") ? (
                                <img
                                  src={doc}
                                  alt={`Tech drawing preview ${idx + 1}`}
                                  className="h-24 object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                                />
                              ) : (
                                <div className="w-24 h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
                                  <FileText className="w-8 h-8 text-blue-600" />
                                </div>
                              )}
                              <button
                                onClick={() =>
                                  removeImage(idx, setTechDrawings)
                                }
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                title="Xóa file"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="relative inline-block">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            onChange={(e) =>
                              handleImageUpload(e, setTechDrawings)
                            }
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 justify-center w-full">
                            <Plus className="w-4 h-4" /> Thêm file khác
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-full w-full flex flex-col items-center justify-center py-4">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) =>
                            handleImageUpload(e, setTechDrawings)
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-blue-100 transition-colors mb-4">
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Tải lên bản vẽ kỹ thuật
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Ảnh hoặc PDF
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  if (renderImages.length === 0) {
                    setError("Vui lòng tải lên hình ảnh Render 3D.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                disabled={renderImages.length === 0}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Tiếp tục
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm text-right">{error}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Chọn phương án thi công
              </h2>
              <p className="text-slate-500">
                Môi trường thi công sẽ quyết định loại vật liệu và kết cấu phù
                hợp.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setEnvironment("indoor")}
                className={`relative p-8 rounded-2xl border-2 text-left transition-all ${environment === "indoor" ? "border-blue-600 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${environment === "indoor" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    <Home className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Trong nhà (Indoor)
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Thích hợp cho trung tâm triển lãm, khách sạn. Ưu tiên vật
                      liệu nhẹ, thẩm mỹ cao (MDF, Formex, Decal).
                    </p>
                  </div>
                </div>
                {environment === "indoor" && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setEnvironment("outdoor")}
                className={`relative p-8 rounded-2xl border-2 text-left transition-all ${environment === "outdoor" ? "border-blue-600 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${environment === "outdoor" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    <Sun className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Ngoài trời (Outdoor)
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Chịu được thời tiết, gió lớn. Ưu tiên khung sắt kiên cố,
                      bạt hiflex, alu, sơn chống thấm.
                    </p>
                  </div>
                </div>
                {environment === "outdoor" && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            </div>

            <div className="flex justify-between pt-8 border-t border-slate-200">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-70 flex items-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Đang bóc tách...
                  </>
                ) : (
                  "Tạo Production Manual"
                )}
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm text-right">{error}</p>
            )}
          </div>
        )}

        {step === 3 && manual && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <ManualDisplay
              manual={manual}
              setManual={setManual}
              renderImages={renderImages}
              techDrawings={techDrawings}
              environment={environment}
              manualRef={manualRef}
              pages={pages}
              setPages={setPages}
              customMaterials={customMaterials}
              bomRowHeight={bomRowHeight}
              setBomRowHeight={setBomRowHeight}
            />
          </div>
        )}
      </main>

      {/* Chatbot Widget */}
      <Chatbot knowledgeBase={knowledgeBase} />

      {/* Knowledge Base Modal */}
      {showKnowledgeBase && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Thư mục Kiến thức
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Đây là nguồn kiến thức chuẩn để AI dựa vào khi tạo "Quy cách sản xuất tiêu chuẩn". Bạn có thể tuỳ chỉnh, thêm bớt kiến thức theo thực tế sản xuất của công ty bạn.
                </p>
              </div>
              <button
                onClick={() => setShowKnowledgeBase(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <textarea
                value={knowledgeBase}
                onChange={(e) => {
                  setKnowledgeBase(e.target.value);
                  localStorage.setItem("booth_knowledge_base", e.target.value);
                }}
                className="w-full h-full min-h-[400px] border border-slate-300 rounded-lg p-4 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Nhập kiến thức chuyên môn, quy cách vật liệu..."
                spellCheck={false}
              />
            </div>

            <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-between items-center">
              <button
                onClick={() => {
                  if (window.confirm("Bạn có chắc muốn khôi phục về kiến thức mặc định chuẩn không?")) {
                    setKnowledgeBase(DEFAULT_KNOWLEDGE_BASE);
                    localStorage.setItem("booth_knowledge_base", DEFAULT_KNOWLEDGE_BASE);
                  }
                }}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
              >
                Khôi phục mặc định
              </button>
              <button
                onClick={() => setShowKnowledgeBase(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                Lưu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  Cài Đặt Thư Viện Vật Liệu
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Quản lý danh sách vật liệu dùng để gợi ý nhập nhanh & AI tự
                  động nhận diện.
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <ul className="space-y-2">
                {customMaterials.map((mat, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm"
                  >
                    {editingIndex === i ? (
                      <div className="flex-1 flex items-center mr-3">
                        <input
                          autoFocus
                          type="text"
                          className="flex-1 border border-blue-400 px-3 py-1.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-100"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave();
                            if (e.key === "Escape") handleEditCancel();
                          }}
                          onBlur={handleEditSave}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-700 flex-1 break-words mr-3">
                        {mat}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {editingIndex !== i && (
                        <button
                          onClick={() => handleEditStart(i, mat)}
                          className="text-slate-300 hover:text-blue-500 transition-colors p-1.5 rounded hover:bg-slate-100"
                          title="Sửa vật liệu"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMaterial(mat)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50"
                        title="Xóa vật liệu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {customMaterials.length === 0 && (
                <p className="text-center text-slate-500 py-8 text-sm">
                  Danh sách vật liệu trống.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-3 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                    Thêm vật liệu mới
                  </label>
                  <input
                    type="text"
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMaterial()}
                    placeholder="VD: Alu gương 3mm cắt CNC..."
                    className="w-full border border-slate-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={handleAddMaterial}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Thêm
                </button>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleExportMaterials}
                    className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" /> Xuất thư viện
                  </button>
                  <label className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" /> Nhập thư viện
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportMaterials}
                    />
                  </label>
                  <div className="w-px h-4 bg-slate-200"></div>
                  <button
                    onClick={handleResetMaterials}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                  >
                    Khôi phục gốc
                  </button>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pin Authorization Modal */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  className,
  placeholder,
  style,
}: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden block ${className}`}
      placeholder={placeholder}
      style={{ ...style, height: "auto" }}
      rows={1}
      title="Nhấn để chỉnh sửa"
    />
  );
}

function AutocompleteTextarea({
  value,
  onChange,
  className,
  placeholder,
  suggestions = [],
}: any) {
  const [show, setShow] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const filtered = suggestions.filter(
    (s: string) =>
      value &&
      s.toLowerCase().includes(value.toLowerCase()) &&
      s.toLowerCase() !== value.toLowerCase(),
  );

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        className={`resize-none overflow-hidden block ${className}`}
        placeholder={placeholder}
        rows={1}
        title="Nhấn để chỉnh sửa"
        onFocus={() => {
          setShow(true);
        }}
        onBlur={() => {
          setTimeout(() => setShow(false), 150); // slight delay to allow click
        }}
        style={{ height: "auto" }}
      />
      {show && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 mt-1 w-72 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-md py-1 text-sm no-print">
          {filtered.map((s: string, i: number) => (
            <li
              key={i}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent text blur
                onChange({ target: { value: s } });
                setShow(false);
              }}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-slate-700 text-left"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualDisplay({
  manual,
  setManual,
  renderImages,
  techDrawings,
  environment,
  manualRef,
  pages,
  setPages,
  customMaterials,
  bomRowHeight,
  setBomRowHeight,
}: {
  manual: ProductionManual;
  setManual: React.Dispatch<React.SetStateAction<ProductionManual | null>>;
  renderImages: string[];
  techDrawings: string[];
  environment: Environment;
  manualRef: React.RefObject<HTMLDivElement>;
  pages: PageDef[];
  setPages: React.Dispatch<React.SetStateAction<PageDef[]>>;
  customMaterials: string[];
  bomRowHeight: "compact" | "normal" | "relaxed";
  setBomRowHeight: React.Dispatch<React.SetStateAction<"compact" | "normal" | "relaxed">>;
}) {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);

  // Editable headers state
  const [headers, setHeaders] = useState({
    title: "PRODUCTION MANUAL",
    subtitle: "Exhibition Booth Breakdown",
    envLabel: "Môi trường thi công",
    envValue:
      environment === "indoor" ? "Trong nhà (Indoor)" : "Ngoài trời (Outdoor)",
    section1: "Bản vẽ chỉ định (Annotated Render)",
    sectionTech: "Bản vẽ kỹ thuật (Technical Drawings)",
    section2: "Bảng vật liệu & Quy cách (BOM)",
    sectionTechSpecs: "Quy cách sản xuất tiêu chuẩn (Technical Specifications)",
    section3: "Lưu ý chung & An toàn",
    col1: "Hạng mục",
    colQuantity: "Số lượng",
    col2: "Kích thước",
    col3: "Mô tả quy cách",
    col4: "Ghi chú thi công",
  });

  const updateHeader = (key: keyof typeof headers, value: string) => {
    setHeaders((prev) => ({ ...prev, [key]: value }));
  };

  let sectionCounter = 1;

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(id);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return;

    const container = e.currentTarget as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    updateAnnotation(draggingId, "x", parseFloat(x.toFixed(2)));
    updateAnnotation(draggingId, "y", parseFloat(y.toFixed(2)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      setDraggingId(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const updateAnnotation = (
    id: string,
    field: keyof Annotation,
    value: string | number,
  ) => {
    setManual((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        annotations: prev.annotations.map((a) =>
          a.id === id ? { ...a, [field]: value } : a,
        ),
      };
    });
  };

  const addAnnotation = () => {
    const newId = Math.random().toString(36).substring(7);
    const newAnn = {
      id: newId,
      x: 50,
      y: 50,
      label: "Hạng mục mới",
      description: "",
      material: "",
      spec: "",
      note: "",
      quantity: 1,
    };

    setManual((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        annotations: [...prev.annotations, newAnn],
      };
    });

    setPages((prev) => {
      const newPages = [...prev];

      // Add to last BOM page
      const lastBomIndex = newPages.map((p) => p.type).lastIndexOf("BOM");
      if (lastBomIndex !== -1) {
        if (
          newPages[lastBomIndex].annotationIds &&
          newPages[lastBomIndex].annotationIds.length >= 5
        ) {
          newPages.splice(lastBomIndex + 1, 0, {
            id: `page-bom-${Math.random()}`,
            type: "BOM",
            title: "Bảng vật liệu & Quy cách (Tiếp theo)",
            annotationIds: [newId],
          });
        } else {
          newPages[lastBomIndex] = {
            ...newPages[lastBomIndex],
            annotationIds: [
              ...(newPages[lastBomIndex].annotationIds || []),
              newId,
            ],
          };
        }
      } else {
        newPages.push({
          id: `page-bom-new`,
          type: "BOM",
          title: "Bảng vật liệu & Quy cách (BOM)",
          annotationIds: [newId],
        });
      }

      // Add to last RENDER page
      const lastRenderIndex = newPages
        .map((p) => p.type)
        .lastIndexOf("COVER_AND_RENDER");
      if (lastRenderIndex !== -1) {
        if (
          newPages[lastRenderIndex].annotationIds &&
          newPages[lastRenderIndex].annotationIds.length >= 4
        ) {
          newPages.splice(lastRenderIndex + 1, 0, {
            id: `page-render-${Math.random()}`,
            type: "COVER_AND_RENDER",
            title: "Bản vẽ chỉ định (Tiếp theo)",
            annotationIds: [newId],
          });
        } else {
          newPages[lastRenderIndex] = {
            ...newPages[lastRenderIndex],
            annotationIds: [
              ...(newPages[lastRenderIndex].annotationIds || []),
              newId,
            ],
          };
        }
      }

      return newPages;
    });
  };

  const removeAnnotation = (id: string) => {
    setManual((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        annotations: prev.annotations.filter((a) => a.id !== id),
      };
    });

    setPages((prev) =>
      prev.map((p) => {
        if (
          (p.type === "BOM" || p.type === "COVER_AND_RENDER") &&
          p.annotationIds
        ) {
          return {
            ...p,
            annotationIds: p.annotationIds.filter((annId) => annId !== id),
          };
        }
        return p;
      }),
    );
  };

  const updateGeneralNotes = (value: string) => {
    setManual((prev) => {
      if (!prev) return prev;
      return { ...prev, generalNotes: value };
    });
  };

  const updateTechnicalSpecs = (value: string) => {
    setManual((prev) => {
      if (!prev) return prev;
      return { ...prev, technicalSpecifications: value };
    });
  };

  const handleReorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    if (!manual) return;

    const newAnns = [...manual.annotations];
    const draggedIdx = newAnns.findIndex((a) => a.id === draggedId);
    const targetIdx = newAnns.findIndex((a) => a.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const [draggedItem] = newAnns.splice(draggedIdx, 1);
    newAnns.splice(targetIdx, 0, draggedItem);
    
    const newOrderedIds = newAnns.map(a => a.id);

    setManual({ ...manual, annotations: newAnns });

    setPages((prevPages) => {
      if (newOrderedIds.length === 0) return prevPages;

      const renderPageIndices = prevPages.map((p, i) => p.type === "COVER_AND_RENDER" ? i : -1).filter(i => i !== -1);
      const bomPageIndices = prevPages.map((p, i) => p.type === "BOM" ? i : -1).filter(i => i !== -1);

      const newPages = [...prevPages];
      
      if (renderPageIndices.length > 0) {
        let currentIdIndex = 0;
        renderPageIndices.forEach(pageIdx => {
           const count = newPages[pageIdx].annotationIds?.length || 0;
           newPages[pageIdx] = {
               ...newPages[pageIdx],
               annotationIds: newOrderedIds.slice(currentIdIndex, currentIdIndex + count)
           };
           currentIdIndex += count;
        });
      }

      if (bomPageIndices.length > 0) {
        let currentIdIndex = 0;
        bomPageIndices.forEach(pageIdx => {
           const count = newPages[pageIdx].annotationIds?.length || 0;
           newPages[pageIdx] = {
               ...newPages[pageIdx],
               annotationIds: newOrderedIds.slice(currentIdIndex, currentIdIndex + count)
           };
           currentIdIndex += count;
        });
      }

      return newPages;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId) {
      handleReorder(draggedId, targetId);
    }
  };

  const movePage = (index: number, direction: number) => {
    const newPages = [...pages];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newPages.length) {
      [newPages[index], newPages[targetIndex]] = [
        newPages[targetIndex],
        newPages[index],
      ];
      setPages(newPages);
    }
  };

  const deletePage = (id: string) => {
    setPages(pages.filter((p) => p.id !== id));
  };

  const PageHeader = () => (
    <div className="bg-slate-900 text-white p-6 flex justify-between items-start shrink-0">
      <div className="flex-1 mr-8">
        <AutoResizeTextarea
          value={headers.title}
          onChange={(e: any) => updateHeader("title", e.target.value)}
          className="text-2xl font-bold tracking-tight bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none w-full text-white leading-tight"
        />
        <AutoResizeTextarea
          value={headers.subtitle}
          onChange={(e: any) => updateHeader("subtitle", e.target.value)}
          className="text-slate-400 mt-1 text-base bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none w-full leading-tight"
        />
      </div>
      <div className="text-right w-64">
        <AutoResizeTextarea
          value={headers.envLabel}
          onChange={(e: any) => updateHeader("envLabel", e.target.value)}
          className="text-xs text-slate-400 uppercase tracking-wider font-semibold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none w-full text-right leading-tight"
        />
        <AutoResizeTextarea
          value={headers.envValue}
          onChange={(e: any) => updateHeader("envValue", e.target.value)}
          className="text-lg font-medium text-blue-400 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none w-full text-right leading-tight"
        />
      </div>
    </div>
  );

  return (
    <div
      className="overflow-x-auto pb-8 -mx-4 sm:mx-0 px-4 sm:px-0 flex flex-col gap-8 items-center printable-container"
      ref={manualRef}
    >
      {pages.map((page, pageIndex) => (
        <div key={page.id} className="relative group flex shrink-0 printable-page-wrapper">
          <div
            className="relative printable-page w-[1123px] h-[794px] bg-white shadow-xl rounded-lg border border-slate-200 flex flex-col shrink-0 overflow-hidden"
          >
            <PageHeader />

            <div className={`flex-1 flex flex-col min-h-0 ${page.type === "BOM" ? "p-4" : "p-8"}`}>
            {/* RENDER PAGE */}
            {page.type === "COVER_AND_RENDER" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 flex-1">
                    <AutoResizeTextarea
                      value={headers.section1}
                      onChange={(e: any) =>
                        updateHeader("section1", e.target.value)
                      }
                      className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full"
                    />
                  </h3>
                  <div className="flex items-center gap-4 no-print">
                    <span className="text-sm text-slate-500">
                      💡 Kéo thả các điểm đánh dấu để di chuyển
                    </span>
                    <button
                      onClick={addAnnotation}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Thêm hạng mục
                    </button>
                  </div>
                </div>

                <div className="flex gap-6 flex-1 min-h-0">
                  {/* Image Area */}
                  <div className="w-2/3 relative border border-slate-200 bg-slate-50 flex items-center justify-center p-4 min-h-0 overflow-hidden">
                    <div
                      className="relative touch-none inline-block max-w-full max-h-full"
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    >
                      <img
                        src={renderImages[0]}
                        alt="Annotated Render"
                        className="max-w-full max-h-[600px] w-auto h-auto block pointer-events-none"
                      />
                      {page.annotationIds?.map((id) => {
                        const ann = manual.annotations.find((a) => a.id === id);
                        const index = manual.annotations.findIndex(
                          (a) => a.id === id,
                        );
                        if (!ann) return null;
                        return (
                          <div
                            key={ann.id}
                            className="absolute group"
                            style={{
                              left: `${ann.x}%`,
                              top: `${ann.y}%`,
                              transform: "translate(-50%, -50%)",
                              zIndex: draggingId === ann.id ? 50 : 10,
                            }}
                          >
                            <div
                              className={`relative z-10 w-5 h-5 text-[10px] bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm border border-white cursor-move transition-transform ${draggingId === ann.id ? "scale-110 ring-2 ring-blue-300" : "hover:scale-110"}`}
                              onPointerDown={(e) =>
                                handlePointerDown(e, ann.id)
                              }
                            >
                              {index + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Annotations List */}
                  <div className="w-1/3 pr-2 space-y-2">
                    {page.annotationIds?.map((id) => {
                      const ann = manual.annotations.find((a) => a.id === id);
                      const index = manual.annotations.findIndex(
                        (a) => a.id === id,
                      );
                      if (!ann) return null;
                      return (
                        <div
                          key={ann.id}
                          draggable={dragEnabledId === ann.id}
                          onDragStart={(e) => handleDragStart(e, ann.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, ann.id)}
                          className={`flex gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 group hover:shadow-md transition-shadow ${dragEnabledId === ann.id ? "opacity-50" : ""}`}
                        >
                          <div
                            className="cursor-move text-slate-400 hover:text-slate-600 self-start mt-0.5 -ml-1 shrink-0 no-print"
                            title="Kéo thả để sắp xếp"
                            onPointerDown={() => setDragEnabledId(ann.id)}
                            onPointerUp={() => setDragEnabledId(null)}
                            onMouseLeave={() => setDragEnabledId(null)}
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="w-5 h-5 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] mt-0.5">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <AutoResizeTextarea
                                value={ann.label}
                                onChange={(e: any) =>
                                  updateAnnotation(
                                    ann.id,
                                    "label",
                                    e.target.value,
                                  )
                                }
                                className="w-full font-bold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                                placeholder="Tên hạng mục"
                              />
                              <button
                                onClick={() => removeAnnotation(ann.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 no-print shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <AutocompleteTextarea
                              value={ann.description}
                              onChange={(e: any) =>
                                updateAnnotation(
                                  ann.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                              suggestions={STANDARD_MATERIALS}
                              className="w-full text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded mt-0.5"
                              placeholder="Mô tả..."
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TECH PAGE */}
            {page.type === "TECH" && page.techIndex !== undefined && (
              <div className="flex-1 flex flex-col h-full min-h-0 relative group">
                <h3 className="text-xl font-bold text-slate-800 mb-4 shrink-0">
                  <AutoResizeTextarea
                    value={headers.sectionTech}
                    onChange={(e: any) =>
                      updateHeader("sectionTech", e.target.value)
                    }
                    className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full"
                  />
                </h3>
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-0 relative">
                  {techDrawings[page.techIndex].startsWith("data:image") ? (
                    <TransformWrapper wheel={{ disabled: true }} doubleClick={{ disabled: true }} minScale={0.1} initialScale={1}>
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <React.Fragment>
                          <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => zoomIn()} className="bg-white p-2 text-slate-600 rounded-md shadow hover:bg-slate-50 cursor-pointer" title="Phóng to">
                              <ZoomIn className="w-5 h-5"/>
                            </button>
                            <button onClick={() => zoomOut()} className="bg-white p-2 text-slate-600 rounded-md shadow hover:bg-slate-50 cursor-pointer" title="Thu nhỏ">
                              <ZoomOut className="w-5 h-5"/>
                            </button>
                            <button onClick={() => resetTransform()} className="bg-white p-2 text-slate-600 rounded-md shadow hover:bg-slate-50 cursor-pointer" title="Đặt lại">
                              <Maximize className="w-5 h-5"/>
                            </button>
                          </div>
                          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img
                              src={techDrawings[page.techIndex]}
                              alt={`Technical Drawing`}
                              className="max-w-full max-h-[650px] w-auto h-auto block"
                            />
                          </TransformComponent>
                        </React.Fragment>
                      )}
                    </TransformWrapper>
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center">
                      <FileText className="w-16 h-16 text-slate-400 mb-4" />
                      <p className="text-slate-600 font-medium">
                        Tài liệu PDF (Không thể hiển thị trực tiếp trong ảnh
                        xuất)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BOM PAGE */}
            {page.type === "BOM" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 flex-1">
                    <AutoResizeTextarea
                      value={page.title}
                      onChange={(e: any) => {
                        const newPages = [...pages];
                        newPages[pageIndex].title = e.target.value;
                        setPages(newPages);
                      }}
                      className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full"
                    />
                  </h3>
                  <div className="flex items-center gap-2 no-print shrink-0">
                    <select
                      value={bomRowHeight}
                      onChange={(e: any) => setBomRowHeight(e.target.value)}
                      className="text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1.5 outline-none hover:bg-slate-50 cursor-pointer"
                      title="Chiều cao hàng"
                    >
                      <option value="compact">Hàng nhỏ</option>
                      <option value="normal">Hàng vừa</option>
                      <option value="relaxed">Hàng lớn</option>
                    </select>
                    <button
                      onClick={addAnnotation}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Thêm hạng mục
                    </button>
                  </div>
                </div>

                <div className="flex-1 rounded-lg border border-slate-200 overflow-hidden flex flex-col">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-2 py-1.5 w-[20%]">
                          <AutoResizeTextarea
                            value={headers.col1}
                            onChange={(e: any) =>
                              updateHeader("col1", e.target.value)
                            }
                            className="bg-transparent w-full font-semibold outline-none hover:bg-slate-200 rounded px-1"
                          />
                        </th>
                        <th className="px-2 py-1.5 w-[10%] text-center">
                          <AutoResizeTextarea
                            value={headers.colQuantity}
                            onChange={(e: any) =>
                              updateHeader("colQuantity", e.target.value)
                            }
                            className="bg-transparent w-full font-semibold outline-none hover:bg-slate-200 rounded px-1 text-center"
                          />
                        </th>
                        <th className="px-2 py-1.5 w-[20%]">
                          <AutoResizeTextarea
                            value={headers.col2}
                            onChange={(e: any) =>
                              updateHeader("col2", e.target.value)
                            }
                            className="bg-transparent w-full font-semibold outline-none hover:bg-slate-200 rounded px-1"
                          />
                        </th>
                        <th className="px-2 py-1.5 w-[25%]">
                          <AutoResizeTextarea
                            value={headers.col3}
                            onChange={(e: any) =>
                              updateHeader("col3", e.target.value)
                            }
                            className="bg-transparent w-full font-semibold outline-none hover:bg-slate-200 rounded px-1"
                          />
                        </th>
                        <th className="px-2 py-1.5 w-[20%]">
                          <AutoResizeTextarea
                            value={headers.col4}
                            onChange={(e: any) =>
                              updateHeader("col4", e.target.value)
                            }
                            className="bg-transparent w-full font-semibold outline-none hover:bg-slate-200 rounded px-1"
                          />
                        </th>
                        <th className="px-2 py-1.5 w-[5%] no-print"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {page.annotationIds?.map((id) => {
                        const ann = manual.annotations.find((a) => a.id === id);
                        const globalIndex = manual.annotations.findIndex(
                          (a) => a.id === id,
                        );
                        if (!ann) return null;
                        
                        const trPy = bomRowHeight === "compact" ? "py-1" : bomRowHeight === "relaxed" ? "py-4" : "py-2.5";
                        const tdClass = `px-2 ${trPy} align-top`;
                        const tdMidClass = `px-2 ${trPy} align-middle`;

                        return (
                          <tr
                            key={ann.id}
                            draggable={dragEnabledId === ann.id}
                            onDragStart={(e) => handleDragStart(e, ann.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, ann.id)}
                            className={`hover:bg-slate-50/50 transition-colors group ${dragEnabledId === ann.id ? "opacity-50" : ""}`}
                          >
                            <td className={`${tdClass} w-[20%]`}>
                              <div className="flex items-start gap-1">
                                <div
                                  className="cursor-move text-slate-400 hover:text-slate-600 mt-1.5 -ml-2 shrink-0 no-print"
                                  title="Kéo thả để sắp xếp"
                                  onPointerDown={() => setDragEnabledId(ann.id)}
                                  onPointerUp={() => setDragEnabledId(null)}
                                  onMouseLeave={() => setDragEnabledId(null)}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <span className="w-4 h-4 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[9px] mt-1.5">
                                  {globalIndex + 1}
                                </span>
                                <AutoResizeTextarea
                                  value={ann.label}
                                  onChange={(e: any) =>
                                    updateAnnotation(
                                      ann.id,
                                      "label",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded p-1 outline-none font-medium text-slate-800"
                                />
                              </div>
                            </td>
                            <td className={`${tdClass} text-center w-[10%]`}>
                              <input
                                type="number"
                                min="1"
                                value={ann.quantity || 1}
                                onChange={(e: any) =>
                                  updateAnnotation(
                                    ann.id,
                                    "quantity",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded p-1 outline-none text-slate-800 text-center"
                              />
                            </td>
                            <td className={`${tdClass} w-[20%]`}>
                              <AutocompleteTextarea
                                value={ann.spec || ""}
                                onChange={(e: any) =>
                                  updateAnnotation(
                                    ann.id,
                                    "spec",
                                    e.target.value,
                                  )
                                }
                                suggestions={STANDARD_MATERIALS}
                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded p-1 outline-none text-slate-600"
                              />
                            </td>
                            <td className={`${tdClass} w-[25%]`}>
                              <AutocompleteTextarea
                                value={ann.description || ""}
                                onChange={(e: any) =>
                                  updateAnnotation(
                                    ann.id,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                suggestions={STANDARD_MATERIALS}
                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded p-1 outline-none text-slate-600"
                              />
                            </td>
                            <td className={`${tdClass} w-[20%]`}>
                              <AutoResizeTextarea
                                value={ann.note || ""}
                                onChange={(e: any) =>
                                  updateAnnotation(
                                    ann.id,
                                    "note",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-1 outline-none text-slate-500 text-[11px]"
                              />
                            </td>
                            <td className={`${tdMidClass} text-center w-[5%] no-print`}>
                              <button
                                onClick={() => removeAnnotation(ann.id)}
                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title="Xóa hạng mục"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TECH SPECS PAGE */}
            {page.type === "TECH_SPECS" && (
              <div className="flex-1 flex flex-col h-full min-h-0">
                <h3 className="text-xl font-bold text-slate-800 mb-4 shrink-0">
                  <AutoResizeTextarea
                    value={headers.sectionTechSpecs}
                    onChange={(e: any) =>
                      updateHeader("sectionTechSpecs", e.target.value)
                    }
                    className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full"
                  />
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex-1 min-h-0">
                  <AutoResizeTextarea
                    value={manual.technicalSpecifications || ''}
                    onChange={(e: any) => updateTechnicalSpecs(e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded p-2 outline-none text-blue-900 leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}

            {/* NOTES PAGE */}
            {page.type === "NOTES" && (
              <div className="flex-1 flex flex-col h-full min-h-0">
                <h3 className="text-xl font-bold text-slate-800 mb-4 shrink-0">
                  <AutoResizeTextarea
                    value={headers.section3}
                    onChange={(e: any) =>
                      updateHeader("section3", e.target.value)
                    }
                    className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full"
                  />
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex-1 min-h-0">
                  <AutoResizeTextarea
                    value={manual.generalNotes}
                    onChange={(e: any) => updateGeneralNotes(e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-amber-300 focus:border-amber-500 focus:bg-white rounded p-2 outline-none text-amber-900 leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="w-full text-center text-slate-400 text-sm shrink-0 pb-4">
            <p>
              Trang {pageIndex + 1}/{pages.length}
            </p>
          </div>
        </div>

        {/* Page Controls (Hidden in Print) */}
        <div className="absolute -right-14 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-print z-50">
          <button
            onClick={() => movePage(pageIndex, -1)}
            disabled={pageIndex === 0}
            className="p-2 bg-white rounded shadow hover:bg-slate-50 disabled:opacity-30"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => movePage(pageIndex, 1)}
            disabled={pageIndex === pages.length - 1}
            className="p-2 bg-white rounded shadow hover:bg-slate-50 disabled:opacity-30"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => deletePage(page.id)}
            className="p-2 bg-white rounded shadow hover:bg-red-50 text-red-500"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      ))}
    </div>
  );
}
