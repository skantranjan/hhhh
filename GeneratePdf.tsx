import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import MultiSelect from '../components/MultiSelect';
import ConfirmModal from '../components/ConfirmModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiGet } from '../utils/api';

// Master Data Response Interface
interface MasterDataResponse {
  success: boolean;
  message: string;
  data: {
    periods?: Array<{id: number, period: string, is_active: boolean}>;
    regions?: Array<{id: number, name: string}>;
    material_types?: Array<{id: number, item_name: string, item_order: number, is_active: boolean}>;
    component_uoms?: Array<{id: number, item_name: string, item_order: number, is_active: boolean}>;
    packaging_materials?: Array<{id: number, item_name: string, item_order: number, is_active: boolean}>;
    packaging_levels?: Array<{id: number, item_name: string, item_order: number, is_active: boolean}>;
    component_base_uoms?: Array<{id: number, item_name: string, item_order: number, is_active: boolean}>;
    total_count?: {
      periods: number;
      regions: number;
      material_types: number;
      component_uoms: number;
      packaging_materials: number;
      packaging_levels: number;
      component_base_uoms: number;
    };
  };
}

// Note: This component now uses the /get-masterdata API to populate filters and data
// This provides consistent data structure from the master data source

const componentFields = [
  'component_code',
  'component_description',
  'component_valid_from',
  'component_valid_to',
  'component_quantity',
  'component_uom_id',
  'component_base_quantity',
  'component_base_uom_id',
  'component_packaging_type_id',
  'component_packaging_material',
  'component_unit_weight',
  'weight_unit_measure_id',
  'percent_mechanical_pcr_content',
  'components_reference',
  'component_material_group',
  'percent_w_w',
  'percent_mechanical_pir_content',
  'percent_chemical_recycled_content',
  'percent_bio_sourced',
  'material_structure_multimaterials',
  'component_packaging_level_id',
  'component_dimensions'
];

// User-friendly labels for the component fields
const componentFieldLabels: { [key: string]: string } = {
  'component_code': 'Component Code',
  'component_description': 'Component Description',
  'component_valid_from': 'Component validity date - From',
  'component_valid_to': 'Component validity date - To',
  'component_quantity': 'Component Qty',
  'component_uom_id': 'Component UoM',
  'component_base_quantity': 'Component Base Qty',
  'component_base_uom_id': 'Component Base UoM',
  'component_packaging_type_id': 'Component Packaging Type',
  'component_packaging_material': 'Component Packaging Material',
  'component_unit_weight': 'Component Unit Weight',
  'weight_unit_measure_id': 'Weight Unit of Measure',
  'percent_mechanical_pcr_content': '% Mechanical Post-Consumer Recycled Content (inc. Chemical)',
  'components_reference': 'Component reference',
  'component_material_group': 'Component Material Group (Category)',
  'percent_w_w': '%w/w',
  'percent_mechanical_pir_content': '% Mechanical Post-Industrial Recycled Content',
  'percent_chemical_recycled_content': '% Chemical Recycled Content',
  'percent_bio_sourced': '% Bio-sourced?',
  'material_structure_multimaterials': 'Material structure - multimaterials only (with % wt)',
  'component_packaging_level_id': 'Component packaging level',
  'component_dimensions': 'Component dimensions (3D - LxWxH, 2D - LxW)'
};

// Reverse mapping from user-friendly labels to database field names
const componentFieldValues: { [key: string]: string } = {
  'Component Code': 'component_code',
  'Component Description': 'component_description',
  'Component validity date - From': 'component_valid_from',
  'Component validity date - To': 'component_valid_to',
  'Component Qty': 'component_quantity',
  'Component UoM': 'component_uom_id',
  'Component Base Qty': 'component_base_quantity',
  'Component Base UoM': 'component_base_uom_id',
  'Component Packaging Type': 'component_packaging_type_id',
  'Component Packaging Material': 'component_packaging_material',
  'Component Unit Weight': 'component_unit_weight',
  'Weight Unit of Measure': 'weight_unit_measure_id',
  '% Mechanical Post-Consumer Recycled Content (inc. Chemical)': 'percent_mechanical_pcr_content',
  'Component reference': 'components_reference',
  'Component Material Group (Category)': 'component_material_group',
  '%w/w': 'percent_w_w',
  '% Mechanical Post-Industrial Recycled Content': 'percent_mechanical_pir_content',
  '% Chemical Recycled Content': 'percent_chemical_recycled_content',
  '% Bio-sourced?': 'percent_bio_sourced',
  'Material structure - multimaterials only (with % wt)': 'material_structure_multimaterials',
  'Component packaging level': 'component_packaging_level_id',
  'Component dimensions (3D - LxWxH, 2D - LxW)': 'component_dimensions'
};

const GeneratePdf: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Data will be loaded from API instead of passed from AdminCmSkuDetail page
  
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'Component Code',
    'Component Description',
    'Component validity date - From',
    'Component validity date - To',
    'Component Qty',
    'Component UoM',
    'Component Base Qty',
    'Component Base UoM',
    'Component Packaging Type',
    'Component Packaging Material',
    'Component Unit Weight',
    'Weight Unit of Measure',
    '% Mechanical Post-Consumer Recycled Content (inc. Chemical)'
  ]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoDataModal, setShowNoDataModal] = useState(false);
  const [showMaxSelectionModal, setShowMaxSelectionModal] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState<boolean>(true);
  
  // Filter states for the required filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [periods, setPeriods] = useState<Array<{id: number, period: string}>>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>('');
  const [selectedComponentType, setSelectedComponentType] = useState<string>('Packaging');
  const [componentTypes, setComponentTypes] = useState<Array<{id: number, item_name: string}>>([]);
  const [selectedComponentPackagingTypes, setSelectedComponentPackagingTypes] = useState<string[]>([]);
  const [componentPackagingTypes, setComponentPackagingTypes] = useState<Array<{id: number, item_name: string, item_name_new?: string}>>([]);
  const [excludeInternal, setExcludeInternal] = useState<boolean>(true);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [skus, setSkus] = useState<Array<{id: number, sku_code: string, sku_description: string}>>([]);
  const [componentBaseUoms, setComponentBaseUoms] = useState<Array<{id: number, item_name: string}>>([]);

  // Applied filter states (what actually filters the data)
  const [appliedPeriod, setAppliedPeriod] = useState<string>('');
  const [appliedComponentType, setAppliedComponentType] = useState<string>('Packaging');
  const [appliedComponentPackagingTypes, setAppliedComponentPackagingTypes] = useState<string[]>([]);
  const [appliedSkus, setAppliedSkus] = useState<string[]>([]);
  const [appliedExcludeInternal, setAppliedExcludeInternal] = useState<boolean>(true);
  const [appliedFields, setAppliedFields] = useState<string[]>([
    'Component Code',
    'Component Description',
    'Component validity date - From',
    'Component validity date - To',
    'Component Qty',
    'Component UoM',
    'Component Base Qty',
    'Component Base UoM',
    'Component Packaging Type',
    'Component Packaging Material',
    'Component Unit Weight',
    'Weight Unit of Measure',
    '% Mechanical Post-Consumer Recycled Content (inc. Chemical)'
  ]);
  
  // Get 3PM Code and Description from URL parameters
  const cmCode = searchParams.get('cmCode') || '';
  const cmDescription = searchParams.get('cmDescription') || '';

  // Data will be loaded from API on page load instead of processing passed data
  // The page now always uses the API as the primary data source

  // Log page initialization
  useEffect(() => {
    console.log('GeneratePdf page initialized with:', {
      cmCode: cmCode,
      cmDescription: cmDescription,
      locationState: location.state
    });
  }, [cmCode, cmDescription, location.state]);

  // Load SKU data from navigation state if available
  useEffect(() => {
    console.log('🔍 Checking navigation state for SKU data...');
    console.log('🔍 Full location.state:', location.state);
    console.log('🔍 location.state?.skuData:', location.state?.skuData);
    console.log('🔍 Is skuData an array?', Array.isArray(location.state?.skuData));
    console.log('🔍 skuData length:', location.state?.skuData?.length);
    
    if (location.state?.skuData && Array.isArray(location.state.skuData)) {
      console.log('📋 SKU data received from navigation state:', location.state.skuData);
      console.log('📋 First SKU item structure:', location.state.skuData[0]);
      
      // Extract unique SKUs from the passed data
      const uniqueSkus = new Map();
      location.state.skuData.forEach((sku: any, index: number) => {
        console.log(`🔍 Processing SKU ${index}:`, sku);
        console.log(`🔍 SKU code: ${sku.sku_code}, SKU description: ${sku.sku_description || sku.description}`);
        
        if (sku.sku_code && !uniqueSkus.has(sku.sku_code)) {
          uniqueSkus.set(sku.sku_code, {
            id: sku.id || index + 1,
            sku_code: sku.sku_code,
            sku_description: sku.sku_description || sku.description || 'No Description'
          });
          console.log(`✅ Added SKU: ${sku.sku_code}`);
        } else {
          console.log(`⚠️ Skipped SKU: ${sku.sku_code} (already exists or no code)`);
        }
      });
      
      const skuOptions = Array.from(uniqueSkus.values());
      console.log('✅ Processed SKU options from navigation state:', skuOptions);
      console.log('✅ Total unique SKUs found:', skuOptions.length);
      setSkus(skuOptions);
    } else {
      console.log('ℹ️ No SKU data in navigation state, will try API loading');
      console.log('ℹ️ Available navigation state keys:', Object.keys(location.state || {}));
    }
  }, [location.state]);

  // Debug SKU state changes
  useEffect(() => {
    console.log('🔍 SKU state changed:', {
      skusLength: skus.length,
      skus: skus,
      selectedSkus: selectedSkus
    });
  }, [skus, selectedSkus]);

  // Filtered data based on selected fields and filters
  const filteredData = tableData.filter(row => {
    // Always apply filters - no bypassing
    let passesFilters = true;
    
    // Filter based on selected component fields (only if fields are selected)
    if (appliedFields.length > 0) {
      const hasMatchingField = appliedFields.some(fieldLabel => {
        const fieldName = componentFieldValues[fieldLabel];
        const hasData = row[fieldName] !== undefined && row[fieldName] !== null && row[fieldName] !== '';
        return hasData;
      });
      passesFilters = passesFilters && hasMatchingField;
    }
    
    // Filter by Component Type if selected
    if (appliedComponentType && row.material_type) {
      // Direct text comparison since API now returns text values
      passesFilters = passesFilters && appliedComponentType === row.material_type;
    }
    
    // Filter by Component Packaging Types if selected
    if (appliedComponentPackagingTypes.length > 0 && row.component_packaging_type_id) {
      // Compare with item_name_new values from the filter selection
      const packagingTypeValue = row.component_packaging_type_id;
      // Find the corresponding packaging type in our master data
      const matchingPackagingType = componentPackagingTypes.find(pt => 
        pt.item_name === packagingTypeValue || pt.item_name_new === packagingTypeValue
      );
      
      if (matchingPackagingType) {
        // Use item_name_new for comparison if available, otherwise fall back to item_name
        const valueToCompare = matchingPackagingType.item_name_new || matchingPackagingType.item_name;
        passesFilters = passesFilters && appliedComponentPackagingTypes.includes(valueToCompare);
      } else {
        // If no match found in master data, compare directly with the original value
        passesFilters = passesFilters && appliedComponentPackagingTypes.includes(packagingTypeValue);
      }
    }
    
    // Filter by SKU if selected
    if (appliedSkus.length > 0 && row.sku_code) {
      passesFilters = passesFilters && appliedSkus.includes(row.sku_code);
    }
    
    // Filter by exclude internal if checked
    if (appliedExcludeInternal && row.skutype === 'internal') {
      passesFilters = false;
    }
    
    return passesFilters;
  });

  // Always use filtered data to ensure proper filtering is applied
  const displayData = filteredData;

  // Debug logging for data flow
  console.log('🔍 Data Flow Debug:', {
    tableDataLength: tableData.length,
    appliedFieldsLength: appliedFields.length,
    appliedPeriod: appliedPeriod,
    filteredDataLength: filteredData.length,
    displayDataLength: displayData.length,
    sampleTableData: tableData[0],
    sampleFilteredData: filteredData[0],
    sampleDisplayData: displayData[0]
  });

  // Select all logic - default to true when data is loaded
  const allSelected = displayData.length > 0 && (selectedRows.length === 0 || displayData.every(row => selectedRows.includes(row.id)));
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(displayData.map(row => row.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleRowSelect = (id: number, checked: boolean) => {
    setSelectedRows(checked ? [...selectedRows, id] : selectedRows.filter(rowId => rowId !== id));
  };

  // Get available columns from the data
  const getAvailableColumns = () => {
    if (tableData.length === 0) return [];
    
    const allColumns = new Set<string>();
    tableData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'id' && key !== 'type') {
          allColumns.add(key);
        }
      });
    });
    
    return Array.from(allColumns);
  };

  const availableColumns = getAvailableColumns();

  // PDF generation handler
  const handleGeneratePDF = () => {
    // Check if any rows are selected
    if (selectedRows.length === 0) {
      setShowNoDataModal(true);
      return;
    }

    try {
      console.log('Starting PDF generation...');
      console.log('Selected rows:', selectedRows);
      console.log('Filtered data length:', filteredData.length);
      
      // Filter data to only include selected rows
      const selectedData = filteredData.filter(row => 
        selectedRows.includes(row.id)
      );
      
      console.log('Selected data for PDF:', selectedData);

      if (selectedData.length === 0) {
        alert('No data selected for PDF generation. Please select at least one row.');
        return;
      }

      // Sanitize the data to prevent circular references and large objects
      const sanitizedData = selectedData.map(row => {
        const sanitizedRow: any = {};
        Object.keys(row).forEach(key => {
          const value = row[key];
          // Convert complex objects to strings, handle null/undefined
          if (value === null || value === undefined) {
            sanitizedRow[key] = '-';
          } else if (typeof value === 'object') {
            sanitizedRow[key] = JSON.stringify(value).substring(0, 50) + '...';
          } else if (typeof value === 'string') {
            // Truncate long strings more aggressively for PDF
            if (value.length > 50) {
              sanitizedRow[key] = value.substring(0, 50) + '...';
            } else {
              sanitizedRow[key] = value;
            }
          } else {
            sanitizedRow[key] = value;
          }
        });
        return sanitizedRow;
      });

      console.log('Sanitized data:', sanitizedData);

      const doc = new jsPDF('landscape'); // Use landscape orientation for wide table
    
      // Define headers based on selected fields
      const headers = ['SKU Code', 'SKU Description', 'CMO Code', 'CMO Description'];
      
      // Add selected component fields to headers
      if (appliedFields.length > 0) {
        headers.push(...appliedFields);
      }
      
      console.log('PDF headers:', headers);

      // Helper function to format cell content for PDF
      const formatCellContent = (value: any, fieldLabel?: string): string => {
        if (value === null || value === undefined || value === '') {
          return '-';
        }
        
        // Format percentage fields
        if (fieldLabel && fieldLabel.includes('%') && value && !isNaN(value)) {
          return `${value}%`;
        }
        
        // Convert to string and truncate if too long
        const stringValue = String(value);
        if (stringValue.length > 40) {
          return stringValue.substring(0, 40) + '...';
        }
        
        return stringValue;
      };

      // Table rows with the data
      const rows = sanitizedData.map(row => {
        const rowData = [
          formatCellContent(row.sku_code),
          formatCellContent(row.sku_description),
          formatCellContent(row.cm_code),
          formatCellContent(row.cm_description)
        ];
        
        // Add selected field values
        if (appliedFields.length > 0) {
          appliedFields.forEach(fieldLabel => {
            const fieldName = componentFieldValues[fieldLabel];
            const value = row[fieldName];
            rowData.push(formatCellContent(value, fieldLabel));
          });
        }
        
        return rowData;
      });
      
      console.log('PDF rows:', rows);

      // Calculate column widths based on content
      const calculateColumnWidths = () => {
        const baseWidths = {
          'SKU Code': 25,
          'SKU Description': 35,
          'CMO Code': 20,
          'CMO Description': 30
        };
        
        const componentFieldWidths = {
          'Component Code': 25,
          'Component Description': 40,
          'Component validity date - From': 30,
          'Component validity date - To': 30,
          'Component Qty': 20,
          'Component UoM': 20,
          'Component Base Qty': 25,
          'Component Base UoM': 25,
          'Component Packaging Type': 35,
          'Component Packaging Material': 35,
          'Component Unit Weight': 25,
          'Weight Unit of Measure': 30,
          '% Mechanical Post-Consumer Recycled Content (inc. Chemical)': 50,
          'Component reference': 25,
          'Component Material Group (Category)': 35,
          '%w/w': 15,
          '% Mechanical Post-Industrial Recycled Content': 45,
          '% Chemical Recycled Content': 30,
          '% Bio-sourced?': 20,
          'Material structure - multimaterials only (with % wt)': 50,
          'Component packaging level': 30,
          'Component dimensions (3D - LxWxH, 2D - LxW)': 40
        };
        
        const widths = [];
        
        // Add base column widths
        widths.push(baseWidths['SKU Code']);
        widths.push(baseWidths['SKU Description']);
        widths.push(baseWidths['CMO Code']);
        widths.push(baseWidths['CMO Description']);
        
        // Add component field widths
        appliedFields.forEach(fieldLabel => {
          const width = componentFieldWidths[fieldLabel as keyof typeof componentFieldWidths] || 25; // Default width
          widths.push(width);
        });
        
        return widths;
      };

      const columnWidths = calculateColumnWidths();

      // Generate the table in the PDF with proper styling
      autoTable(doc, {
        head: [headers],
        body: rows,
        columnStyles: headers.reduce((acc, header, index) => {
          acc[index] = { 
            cellWidth: columnWidths[index] || 25,
            halign: 'left',
            valign: 'middle'
          };
          return acc;
        }, {} as any),
        styles: { 
          fontSize: 6,
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          halign: 'left',
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: { 
          fillColor: [40, 167, 69], // Green color matching the table
          textColor: [255, 255, 255], // White text
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 6,
          cellPadding: 1,
          halign: 'left',
          valign: 'middle',
          overflow: 'linebreak'
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        margin: { top: 40, left: 10, right: 10 },
        startY: 50,
        tableWidth: 'auto',
        showHead: 'everyPage',
        didDrawPage: function (data) {
          // Add title
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text('Component Data Report', data.settings.margin.left, 20);
          
          // Add subtitle with filter info
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`CMO Code: ${cmCode}`, data.settings.margin.left, 35);
          doc.text(`CMO Description: ${cmDescription}`, data.settings.margin.left, 45);
          
          // Add generation info
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, data.settings.margin.left, 55);
          
          // Add data summary
          const skuCount = selectedData.filter(row => row.type === 'sku').length;
          const componentCount = selectedData.filter(row => row.type === 'component').length;
          doc.text(`Data Summary: ${skuCount} SKUs, ${componentCount} Components`, data.settings.margin.left, 65);
        }
      });

      console.log('PDF generated successfully, navigating to SendForApproval page...');
        
      // Navigate to the SendForApproval page with PDF data
      navigate('/sedforapproval', { 
        state: { 
          selectedRows: selectedRows,
          tableData: tableData,
          cmCode: cmCode,
          cmDescription: cmDescription,
          selectedFields: appliedFields, // Pass the applied fields for PDF generation
          selectedData: selectedData, // Pass the filtered data for PDF generation
          selectedPeriod: appliedPeriod, // Pass the selected period
          generatePDF: true // Flag to indicate PDF should be generated
        }
      });
      
      console.log('Navigated to SendForApproval page successfully!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error generating PDF: ${errorMessage}. Please try again or contact support.`);
    }
  };

  // Handle field selection with max 15 limit
  const handleFieldSelection = (newSelectedFields: string[]) => {
    if (newSelectedFields.length > 15) {
      setShowMaxSelectionModal(true);
    } else {
      setSelectedFields(newSelectedFields);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowNoDataModal(false);
  };

  const handleCloseMaxSelectionModal = () => {
    setShowMaxSelectionModal(false);
  };

  // Handle reset filters button click
  const handleResetFilters = () => {
    console.log('🔄 Resetting all filters to default values...');
    
    // Reset all filter states to default values
    setSelectedPeriod('');
    setSelectedComponentType('Packaging');
    setSelectedComponentPackagingTypes([]);
    setExcludeInternal(true);
    
    // Reset applied filter states
    setAppliedPeriod('');
    setAppliedComponentType('Packaging');
    setAppliedComponentPackagingTypes([]);
    setAppliedExcludeInternal(true);
    
    // Reset selected rows
    setSelectedRows([]);
    
    // Reset table data
    setTableData([]);
    
    // Reload data with default filters
    console.log('🔄 Reloading data with default filters...');
    loadInitialData();
    
    console.log('✅ All filters reset to default values');
  };

  // Handle apply filters button click
  const handleApplyFilters = () => {
    console.log('Applying filters...');
    console.log('Current table data length:', tableData.length);
    console.log('Selected Period:', selectedPeriod);
    console.log('Selected Component Type:', selectedComponentType);
    console.log('Selected Component Packaging Types:', selectedComponentPackagingTypes);
    // console.log('Selected SKUs:', selectedSkus); // Hidden filter
    console.log('Exclude Internal:', excludeInternal);
    console.log('Selected Fields:', selectedFields);
    
    // Apply the selected filters to the applied filter states
    setAppliedPeriod(selectedPeriod);
    setAppliedComponentType(selectedComponentType);
    setAppliedComponentPackagingTypes([...selectedComponentPackagingTypes]);
    // setAppliedSkus([...selectedSkus]); // Hidden filter
    setAppliedExcludeInternal(excludeInternal);
    setAppliedFields([...selectedFields]);
    
    // Set filter applied flag
    setIsFilterApplied(true);
    
    // Call backend API to get filtered data
    const filters = {
      cm_code: cmCode,
      period_id: selectedPeriod || undefined,
      material_type: selectedComponentType || undefined,
      // sku_codes: selectedSkus.length > 0 ? selectedSkus : undefined, // Hidden filter
      component_packaging_types: selectedComponentPackagingTypes.length > 0 ? selectedComponentPackagingTypes : undefined,
      exclude_internal: excludeInternal
    };
    
    console.log('🚀 Calling backend API with filters:', filters);
    fetchFilteredComponents(filters);
    
    console.log('✅ Filters applied successfully!');
    console.log('Applied Period:', selectedPeriod);
    console.log('Applied Component Type:', selectedComponentType);
    console.log('Applied Component Packaging Types:', selectedComponentPackagingTypes);
    // console.log('Applied SKUs:', selectedSkus); // Hidden filter
    console.log('Applied Exclude Internal:', excludeInternal);
    console.log('Applied Fields:', selectedFields);
  };

  // API call to filter components
  const fetchFilteredComponents = async (filters: {
    cm_code: string;
    period_id?: string;
    material_type?: string;
    sku_code?: string;
    component_packaging_types?: string[];
    exclude_internal?: boolean;
  }, retryCount = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Calling backend filter API with:', filters);
      console.log('🔄 Retry attempt:', retryCount + 1);
      
      // Build query string for GET request
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            // Handle array values (like component_packaging_type_ids)
            value.forEach(item => queryParams.append(key, item.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
      
      const endpoint = `/components/filterdata-generatepdf?${queryParams.toString()}`;
      console.log('🌐 Full API endpoint:', endpoint);
      
      const response = await apiGet(endpoint);
      
      console.log('📡 Backend API Response:', response);
      console.log('📊 API Response Data Structure:', {
        totalRecords: response.data?.length || 0,
        totalCount: response.total_count || 0,
        sampleRecord: response.data?.[0] || 'No data',
        fieldNames: response.data?.[0] ? Object.keys(response.data[0]) : [],
        queryInfo: response.query_info || {},
        excelPdfGeneration: response.excel_pdf_generation || {}
      });
      
      if (response.success) {
        // Transform the API response using the shared transform function
        const transformedData = transformApiResponse(response.data);
        
        // Update table data with filtered results
        setTableData(transformedData);
        
        // Extract and update SKUs for filter dropdown
        const uniqueSkus = extractUniqueSkus(response.data);
        setSkus(uniqueSkus);
        
        console.log('✅ Backend filtering completed successfully!');
        console.log('📊 Total records returned:', response.total_count || response.data?.length || 0);
        console.log('📋 Table data updated with', transformedData.length, 'records');
        console.log('🔧 SKU filter options updated:', skus.length, 'unique SKUs');
        console.log('📄 Excel PDF Generation Info:', response.excel_pdf_generation || {});
        console.log('🔍 Query Info:', response.query_info || {});
        
        console.log('🔄 Transformed data for table:', transformedData);
        console.log('📋 Sample transformed record:', transformedData[0]);
        
      } else {
        console.error('❌ Backend API returned error:', response.message);
        
        // Check if it's a database connection error
        if (response.message && response.message.includes('connection slots are reserved')) {
          if (retryCount < 3) {
            console.log(`🔄 Database connection error detected. Retrying in ${(retryCount + 1) * 2} seconds...`);
            setTimeout(() => {
              fetchFilteredComponents(filters, retryCount + 1);
            }, (retryCount + 1) * 2000); // 2s, 4s, 6s delays
            return;
          } else {
            setError(`Database connection pool exhausted. Please try again in a few minutes. (Attempted ${retryCount + 1} times)`);
          }
        } else {
          setError(`Backend filtering failed: ${response.message}`);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Error calling backend filter API:', error);
      
      // Check if it's a database connection error
      if (error.message && error.message.includes('connection slots are reserved')) {
        if (retryCount < 3) {
          console.log(`🔄 Database connection error detected. Retrying in ${(retryCount + 1) * 2} seconds...`);
          setTimeout(() => {
            fetchFilteredComponents(filters, retryCount + 1);
          }, (retryCount + 1) * 2000); // 2s, 4s, 6s delays
          return;
        } else {
          setError(`Database connection pool exhausted. Please try again in a few minutes. (Attempted ${retryCount + 1} times)`);
        }
      } else {
        setError(`Failed to fetch filtered data: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to load initial component data from API with default filters
  const loadInitialData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading initial component data from API with default filters...');
      console.log('🔍 CM Code for API call:', cmCode);
      console.log('🔄 Retry attempt:', retryCount + 1);
      
      // Call API with default filter values (Period, Component Type, exclude_internal)
      const defaultFilters = {
        cm_code: cmCode,
        period_id: currentPeriod || undefined, // Include period_id
        material_type: 'Packaging', // Default filter value
        exclude_internal: true // Default filter value
      };
      
      // Build query string for GET request
      const queryParams = new URLSearchParams();
      Object.entries(defaultFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      
      const endpoint = `/components/filterdata-generatepdf?${queryParams.toString()}`;
      console.log('🌐 Initial API endpoint with default filters:', endpoint);
      console.log('📋 Payload parameters:', defaultFilters);
      
      const response = await apiGet(endpoint);
      
      console.log('📡 Initial API Response:', response);
      console.log('📡 Response success:', response.success);
      console.log('📡 Response data type:', typeof response.data);
      console.log('📡 Response data length:', response.data?.length);
      
      if (response.success) {
        // Transform the API response to match our table structure
        const transformedData = transformApiResponse(response.data);
        setTableData(transformedData);
        
        // Extract SKUs for filter dropdown
        console.log('🔍 Extracting SKUs from response data:', response.data);
        const uniqueSkus = extractUniqueSkus(response.data);
        console.log('📋 Extracted unique SKUs:', uniqueSkus);
        setSkus(uniqueSkus);
        
        // Set default component fields if none are selected
        if (selectedFields.length === 0) {
          const defaultFields = [
            'Component Code',
            'Component Description',
            'Component validity date - From',
            'Component validity date - To',
            'Component Qty',
            'Component UoM',
            'Component Base Qty',
            'Component Base UoM',
            'Component Packaging Type',
            'Component Packaging Material',
            'Component Unit Weight',
            'Weight Unit of Measure',
            '% Mechanical Post-Consumer Recycled Content (inc. Chemical)'
          ];
          setSelectedFields(defaultFields);
          setAppliedFields(defaultFields);
          console.log('✅ Default component fields set:', defaultFields);
        }

        // Auto-select all rows by default
        const allRowIds = transformedData.map(row => row.id);
        setSelectedRows(allRowIds as any); // Type assertion for compatibility
        console.log('✅ All rows auto-selected by default:', allRowIds.length);
        
        // Set applied filter states to reflect the default filters that were used
        setAppliedPeriod(currentPeriod);
        setAppliedComponentType('Packaging');
        setAppliedExcludeInternal(true);
        console.log('✅ Applied default filter states: Period, Packaging component type, exclude internal');
        
        console.log('✅ Initial data loaded successfully:', {
          totalRecords: transformedData.length,
          uniqueSkus: skus.length,
          defaultFieldsSet: selectedFields.length > 0
        });
      } else {
        console.error('❌ Initial API call failed:', response.message);
        
        // Check if it's a database connection error
        if (response.message && response.message.includes('connection slots are reserved')) {
          if (retryCount < 3) {
            const delaySeconds = Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s
            console.log(`🔄 Database connection pool exhausted. Retrying in ${delaySeconds} seconds...`);
            setError(`Database connection pool exhausted. Retrying in ${delaySeconds} seconds... (Attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              loadInitialData(retryCount + 1);
            }, delaySeconds * 1000);
            return;
          } else {
            setError(`Database connection pool exhausted. Please wait 2-3 minutes and try again. If the issue persists, contact the backend team. (Attempted ${retryCount + 1} times)`);
          }
        } else {
          setError(`Failed to load initial data: ${response.message}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading initial data:', error);
      console.error('❌ Error details:', error);
      
      // Check if it's a database connection error
      if (error.message && error.message.includes('connection slots are reserved')) {
        if (retryCount < 3) {
          const delaySeconds = Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s
          console.log(`🔄 Database connection pool exhausted. Retrying in ${delaySeconds} seconds...`);
          setError(`Database connection pool exhausted. Retrying in ${delaySeconds} seconds... (Attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            loadInitialData(retryCount + 1);
          }, delaySeconds * 1000);
          return;
        } else {
          setError(`Database connection pool exhausted. Please wait 2-3 minutes and try again. If the issue persists, contact the backend team. (Attempted ${retryCount + 1} times)`);
        }
      } else {
        setError(`Failed to load initial data: ${error.message || 'Unknown error'}`);
      }
      
      // Set empty SKUs array on error
      setSkus([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format dates to DD/MM/YYYY
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '-';
    }
  };

  // Helper function to transform API response
  const transformApiResponse = (apiData: any[]) => {
    return apiData.map((item: any, index: number) => {
      // Create a unique ID for each row
      const rowId = `api-${index + 1}`;
      
      // Determine if this is a SKU row or component row
      const isComponentRow = item['component_code'] && item['component_code'] !== null;
      const rowType = isComponentRow ? 'component' : 'sku';
      
      return {
        id: rowId,
        type: rowType,
        // SKU level fields
        sku_code: item['sku_code'] || '-',
        sku_description: item['sku_description'] || '-',
        sku_reference: item['sku_reference'] || '-',
        skutype: item['skutype'] || 'external',
        bulk_expert: item['formulation_reference'] || '-',
        is_approved: true, // Default to true
        is_active: item['sku_is_active'] || true,
        
        // Component level fields (only for component rows)
        component_code: item['component_code'] || '-',
        component_description: item['component_description'] || '-',
        component_valid_from: formatDate(item['mapping_valid_from']),
        component_valid_to: formatDate(item['mapping_valid_to']),
        component_material_group: '-', // Not in API response
        component_quantity: item['component_quantity'] || '-',
        component_uom_id: item['component_uom_id'] || '-',
        component_base_quantity: item['component_base_quantity'] || '-',
        component_base_uom_id: item['component_base_uom_id'] || '-',
        percent_w_w: item['percent_w_w'] || '-',
        evidence: '-', // Not in API response
        component_packaging_type_id: item['component_packaging_type_id'] || '-',
        component_packaging_type_display: item['component_packaging_type_id'] || '-', // Store original value for display
        component_packaging_material: item['Component Packaging Material'] || '-',
        component_unit_weight: '-', // Not in API response
        weight_unit_measure_id: '-', // Not in API response
        percent_mechanical_pcr_content: '-', // Not in API response
        percent_mechanical_pir_content: '-', // Not in API response
        percent_chemical_recycled_content: '-', // Not in API response
        percent_bio_sourced: '-', // Not in API response
        material_structure_multimaterials: '-', // Not in API response
        component_packaging_color_opacity: '-', // Not in API response
        component_packaging_level_id: '-', // Not in API response
        component_dimensions: '-', // Not in API response
        packaging_specification_evidence: '-', // Not in API response
        evidence_of_recycled_or_bio_source: '-', // Not in API response
        last_update_date: '-', // Not in API response
        
        // Additional fields from API
        cm_code: item['sku_cm_code'] || cmCode,
        cm_description: item['cm_description'] || cmDescription,
        purchased_quantity: '-', // Not in API response
        sku_reference_check: '-', // Not in API response
        material_type: 'Packaging', // Default based on filter
        material_type_id: 'Packaging', // Default based on filter
        components_reference: '-', // Not in API response
        helper_column: '-', // Not in API response
        site: item['site'] || '-',
        period: item['period'] || '-'
      };
    });
  };


  // Helper function to extract unique SKUs for filter dropdown
  const extractUniqueSkus = (apiData: any[]) => {
    console.log('🔍 extractUniqueSkus called with data:', apiData);
    console.log('🔍 Data length:', apiData?.length);
    console.log('🔍 First item structure:', apiData?.[0]);
    
    const uniqueSkus = new Map();
    
    if (!apiData || !Array.isArray(apiData)) {
      console.warn('⚠️ apiData is not an array or is undefined');
      return [];
    }
    
    apiData.forEach((item: any, index: number) => {
      const skuCode = item['SKU Code'];
      console.log(`🔍 Item ${index}:`, { skuCode, skuDescription: item['SKU Description'] });
      
      if (skuCode && !uniqueSkus.has(skuCode)) {
        uniqueSkus.set(skuCode, {
          id: uniqueSkus.size + 1,
          sku_code: skuCode,
          sku_description: item['SKU Description'] || skuCode
        });
        console.log(`✅ Added SKU: ${skuCode}`);
      }
    });
    
    const result = Array.from(uniqueSkus.values());
    console.log('📋 Final unique SKUs result:', result);
    return result;
  };

  // Function to fetch master data (e.g., periods, packaging types, etc.)
  const fetchMasterData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
   
      
      const response = await apiGet('/masterdata');
      console.log('📡 Raw API Response:', response);
      
      if (response.success) {
        // The API returns {success: true, data: {...}} so we access response.data directly
        console.log('📊 Parsed Master Data:', response.data);

        // Update state with fetched data
        if (response.data.periods) {
          const processedPeriods = response.data.periods.map((item: any) => {
            if (typeof item === 'string') {
              return { id: parseInt(item), period: item };
            } else if (item && typeof item === 'object' && item.id && item.period) {
              return { id: parseInt(item.id), period: item.period };
            } else {
              return null;
            }
          }).filter((item: any): item is { id: number; period: string } => item !== null);
          
          // Sort periods by ID in descending order to get most recent first
          const sortedPeriods = [...processedPeriods].sort((a, b) => b.id - a.id);
          setPeriods(sortedPeriods);
          console.log('📅 Periods set (sorted by ID desc):', sortedPeriods);
          
          // Auto-select the most recent period (current period with largest value)
          if (sortedPeriods.length > 0) {
            const currentPeriodData = sortedPeriods[0]; // First item is the largest ID
            setCurrentPeriod(currentPeriodData.id.toString());
            setSelectedPeriod(currentPeriodData.id.toString());
            setAppliedPeriod(currentPeriodData.id.toString());
            console.log('✅ Auto-selected current period (largest value):', currentPeriodData.period);
          }
        } else {
          console.warn('⚠️ No periods data found in API response');
        }
        
        if (response.data.material_types) {
          setComponentTypes(response.data.material_types);
          console.log('📦 Component Types set from material_types:', response.data.material_types);
        } else {
          console.warn('⚠️ No material_types data found in API response');
        }
        
        if (response.data.component_packaging_type) {
          setComponentPackagingTypes(response.data.component_packaging_type);
          console.log('🔧 Component Packaging Types set from component_packaging_type:', response.data.component_packaging_type?.map((p: any) => ({ id: p.id, item_name: p.item_name, item_name_new: p.item_name_new })));
        } else {
          console.warn('⚠️ No component_packaging_type data found in API response');
        }
        
        if (response.data.component_base_uoms) {
          setComponentBaseUoms(response.data.component_base_uoms);
          console.log('⚖️ Component Base UoM Filter Options:', response.data.component_base_uoms?.map((u: any) => ({ id: u.id, item_name: u.item_name, is_active: u.is_active })));
        } else {
          console.warn('⚠️ No component_base_uoms data found in API response');
        }
        
        // Check if SKUs are available in master data
        if (response.data.skus) {
          console.log('📋 SKUs found in master data:', response.data.skus);
          const skuOptions = response.data.skus.map((sku: any) => ({
            id: sku.id,
            sku_code: sku.sku_code,
            sku_description: sku.sku_description
          }));
          setSkus(skuOptions);
          console.log('✅ SKUs loaded from master data:', skuOptions);
        } else {
          console.log('ℹ️ No SKUs found in master data');
        }
        
        console.log('🎯 Master data loaded successfully with correct binding:');
        console.log('  - Periods: periods array');
        console.log('  - Component Type: material_types array (mapped from API)');
        console.log('  - Component Packaging Type: component_packaging_type array');
        
        // Log detailed binding information
        console.log('📋 Detailed Filter Binding:');
        console.log('  📅 Period Filter Options:', response.data.periods?.map((p: any) => ({ id: p.id, period: p.period, is_active: p.is_active })));
        console.log('  📦 Component Type Filter Options:', response.data.material_types?.map((m: any) => ({ id: m.id, item_name: m.item_name, is_active: m.is_active })));
        console.log('  🔧 Component Packaging Type Filter Options:', response.data.component_packaging_type?.map((p: any) => ({ id: p.id, item_name: p.item_name, item_name_new: p.item_name_new, is_active: p.is_active })));
        console.log('  ⚖️ Component Base UoM Filter Options:', response.data.component_base_uoms?.map((u: any) => ({ id: u.id, item_name: u.item_name, is_active: u.is_active })));

      } else {
        console.error('❌ API Response indicates failure:', response);
        const errorMsg = `API Error: ${response.message || 'Unknown error'}`;
        setError(errorMsg);
        console.error('Failed to fetch master data:', response.message);
      }
    } catch (error) {
      console.error('❌ Error fetching master data:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check if it's a database connection error
      if (errorMessage.includes('connection slots are reserved')) {
        if (retryCount < 3) {
          const delaySeconds = Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s
          console.log(`🔄 Database connection pool exhausted. Retrying in ${delaySeconds} seconds...`);
          setError(`Database connection pool exhausted. Retrying in ${delaySeconds} seconds... (Attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            fetchMasterData(retryCount + 1);
          }, delaySeconds * 1000);
          return;
        } else {
          setError(`Database connection pool exhausted. Please wait 2-3 minutes and try again. If the issue persists, contact the backend team. (Attempted ${retryCount + 1} times)`);
        }
      } else {
        setError(`Failed to load master data: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // No fallback data function - rely on API data only

  // Initial data loading on component mount
  useEffect(() => {
    // Load master data for filter dropdowns first
    fetchMasterData();
  }, []);

  // Load initial component data after period is set
  useEffect(() => {
    if (currentPeriod) {
      console.log('🔄 Period is set, loading initial component data...');
      loadInitialData();
    }
  }, [currentPeriod]);

  // Note: Default filters are now applied during initial data loading
  // No need for separate useEffect to apply default filters

  // Update table when component fields selection changes
  useEffect(() => {
    if (tableData.length > 0 && appliedFields.length > 0) {
      console.log('🔄 Component fields selection changed, updating table display');
      // The table will automatically re-render with new columns based on appliedFields
    }
  }, [appliedFields, tableData]);


  return (
    <Layout>
      <div className="mainInternalPages">
        <div style={{ marginBottom: 8 }}>
        </div>
        {/* Dashboard Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '12px 0'
        }}>
          <div className="commonTitle">
            <div className="icon">
              <i className="ri-file-pdf-2-fill"></i>
            </div>
            <h1>Generate PDF</h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'linear-gradient(135deg, #30ea03 0%, #28c402 100%)',
              border: 'none',
              color: '#000',
              fontSize: 14,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px 16px',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              minWidth: '100px',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <i className="ri-arrow-left-line" style={{ fontSize: 18, marginRight: 6 }} />
            Back
          </button>
        </div>

        {/* 3PM Info Section */}
        <div className="filters CMDetails">
          <div className="row">
            <div className="col-sm-12 ">
              <ul style={{ display: 'flex', alignItems: 'center', padding: '6px 15px 8px' }}>
                <li><strong>CMO Code: </strong> {cmCode}</li>
                <li> | </li>
                <li><strong>CMO Description: </strong> {cmDescription}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error Display Section */}
        


        {/* Filters Section */}
        <div className="row"> 
          <div className="col-sm-12">
            <div className="filters">
                             <ul>

                 <li>
                   <div className="fBold">Period</div>
                   <div className="form-control">
                     <select
                       value={currentPeriod}
                       disabled={true}
                       style={{
                         width: '100%',
                         padding: '8px 12px',
                         borderRadius: '4px',
                         fontSize: '14px',
                         backgroundColor: '#f5f5f5',
                         border: '1px solid #ddd',
                         outline: 'none',
                         color: '#666',
                         cursor: 'not-allowed'
                       }}
                     >
                       <option value={currentPeriod}>
                         {periods.find(p => p.id.toString() === currentPeriod)?.period || 'Loading...'}
                       </option>
                     </select>
                   </div>
                 </li>

                <li>
                  <div className="fBold">Component Type</div>
                  <div className="form-control">
                    <select
                      value={selectedComponentType}
                      onChange={(e) => setSelectedComponentType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        backgroundColor: '#fff',
                        border: 'none',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Component Type</option>
                      {componentTypes.map((componentType) => (
                        <option key={componentType.id} value={componentType.item_name}>
                          {componentType.item_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
                <li>
                  <div className="fBold">Component Packaging Types</div>
                  <div className="form-control">
                    <MultiSelect
                      options={componentPackagingTypes.map(packagingType => ({ 
                        value: packagingType.item_name_new || packagingType.item_name, 
                        label: packagingType.item_name_new || packagingType.item_name 
                      }))}
                      selectedValues={selectedComponentPackagingTypes}
                      onSelectionChange={setSelectedComponentPackagingTypes}
                      placeholder={componentPackagingTypes.length === 0 ? "Loading packaging types..." : "Select Component Packaging Types..."}
                      disabled={componentPackagingTypes.length === 0}
                      loading={componentPackagingTypes.length === 0}
                    />
                  </div>
                </li>
                {/* SKU filter hidden as requested */}
                {/* <li>
                  <div className="fBold">SKU</div>
                  <div className="form-control">
                    <MultiSelect
                      options={skus.map(sku => ({ 
                        value: sku.sku_code, 
                        label: `${sku.sku_code} - ${sku.sku_description}` 
                      }))}
                      selectedValues={selectedSkus}
                      onSelectionChange={setSelectedSkus}
                      placeholder={skus.length === 0 ? "Loading SKUs..." : "Select SKUs..."}
                      disabled={skus.length === 0}
                      loading={skus.length === 0}
                    />
                  </div>
                </li> */}
                <li>
                  <div className="fBold">Component Fields</div>
                  <div className="form-control">
                    <MultiSelect
                      options={Object.values(componentFieldLabels).map(label => ({ value: label, label: label }))}
                      selectedValues={selectedFields}
                      onSelectionChange={handleFieldSelection}
                      placeholder="Select Component Fields..."
                      disabled={componentFields.length === 0}
                      loading={false}
                    />
                  </div>
                </li>
                <li>
                  <div className="filter-options">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="excludeInternal"
                          checked={excludeInternal}
                          onChange={(e) => setExcludeInternal(e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                          }}
                        />
                        <label 
                          htmlFor="excludeInternal" 
                          style={{ 
                            margin: '0', 
                            fontSize: '14px', 
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          Exclude Internal
                        </label>
                      </div>

                    </div>
                  </div>
                </li>
                <li>
                  <button className="btnCommon btnGreen filterButtons" onClick={handleApplyFilters} disabled={loading}>
                    <span>Filters</span>
                    <i className="ri-search-line"></i>
                  </button>
                </li>
                <li>
                  <button className="btnCommon btnGreen filterButtons" onClick={handleResetFilters} disabled={loading}>
                    <span>Reset</span>
                    <i className="ri-refresh-line"></i>
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Action Buttons Section */}
          <div className="row" style={{ marginTop: '20px' }}>
            <div className="col-12">
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>

                <button
                  style={{ 
                    background: '#30ea03', 
                    color: '#000', 
                    border: '1px solid #30ea03',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: selectedRows.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedRows.length === 0 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={handleGeneratePDF}
                  disabled={selectedRows.length === 0}
                >
                  <i className="ri-file-pdf-2-line" style={{ fontSize: '16px' }}></i>
                  Generate PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <i className="ri-loader-4-line spinning" style={{ fontSize: '24px', color: '#666' }}></i>
            <p>Loading component details...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
            <p>Error loading component details: {error}</p>
          </div>
        )}

                                   {tableData.length > 0 && appliedFields.length > 0 ? (
          <div className="row">
            <div className="col-12">
              {/* Record Count Display - Hidden as requested */}
              
              <div style={{ 
                border: '1px solid #e9ecef',
                overflow: 'hidden'
              }}>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    margin: 0
                  }}>
                    <thead>
                      <tr style={{ 
                        borderBottom: '1px solid #000'
                      }}>
                        <th style={{ 
                          width: '60px', 
                          textAlign: 'center', 
                          padding: '3px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          background: '#495057',
                          color: 'white',
                          border: '1px solid #000'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={e => handleSelectAll(e.target.checked)}
                              aria-label="Select All"
                              style={{ 
                                transform: 'scale(1.2)',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        </th>

                        <th style={{ 
                          padding: '3px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          background: '#495057',
                          color: 'white',
                          border: '1px solid #000',
                          minWidth: '140px',
                          whiteSpace: 'nowrap'
                        }}>
                          SKU Code
                        </th>
                        <th style={{ 
                          padding: '3px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          background: '#495057',
                          color: 'white',
                          border: '1px solid #000',
                          minWidth: '160px',
                          whiteSpace: 'nowrap'
                        }}>
                          SKU Description
                        </th>
                        <th style={{ 
                          padding: '3px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          background: '#495057',
                          color: 'white',
                          border: '1px solid #000',
                          minWidth: '120px',
                          whiteSpace: 'nowrap'
                        }}>
                          CMO Code
                        </th>
                        <th style={{ 
                          padding: '3px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          background: '#495057',
                          color: 'white',
                          border: '1px solid #000',
                          minWidth: '140px',
                          whiteSpace: 'nowrap'
                        }}>
                          CMO Description
                        </th>
                        {appliedFields.length > 0 ? (
                          appliedFields.map(fieldLabel => (
                            <th key={fieldLabel} style={{ 
                              padding: '8px 12px',
                              fontWeight: 'bold',
                              fontSize: '14px',
                              textAlign: 'left',
                              background: '#495057',
                              color: 'white',
                              border: '1px solid #000',
                              minWidth: '140px',
                              whiteSpace: 'nowrap'
                            }}>
                              {fieldLabel}
                            </th>
                          ))
                        ) : (
                          <th style={{ 
                            padding: '8px 12px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            textAlign: 'left',
                            background: '#495057',
                            color: 'white',
                            border: '1px solid #000',
                            minWidth: '200px',
                            whiteSpace: 'nowrap'
                          }}>
                            Select Component Fields to see data
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.length === 0 ? (
                        <tr>
                          <td colSpan={appliedFields.length + 5} style={{ 
                            textAlign: 'center', 
                            padding: '40px 20px',
                            color: '#6c757d'
                          }}>
                            <div>No data matches the selected component fields</div>
                          </td>
                        </tr>
                      ) : (
                        displayData.map((row, index) => (
                          <tr key={row.id || index} 
                              style={{ 
                                borderBottom: '1px solid #f1f3f4',
                                transition: 'all 0.2s ease',
                                background: row.type === 'sku' ? '#e8f5e8' : (index % 2 === 0 ? '#ffffff' : '#f8f9fa'),
                                fontWeight: row.type === 'sku' ? '600' : 'normal'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = row.type === 'sku' ? '#d4edda' : '#f8f9fa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = row.type === 'sku' ? '#e8f5e8' : (index % 2 === 0 ? '#ffffff' : '#f8f9fa');
                              }}>
                            <td style={{ 
                              textAlign: 'center', 
                              padding: '4px 12px',
                              verticalAlign: 'middle',
                              border: '1px solid #dee2e6'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(row.id)}
                                  onChange={e => handleRowSelect(row.id, e.target.checked)}
                                  aria-label={`Select row ${row.id}`}
                                  style={{ 
                                    transform: 'scale(1.1)',
                                    cursor: 'pointer'
                                  }}
                                />
                              </div>
                            </td>


                            <td style={{ 
                              padding: '4px 12px',
                              verticalAlign: 'middle',
                              fontWeight: row.type === 'sku' ? '600' : '500',
                              color: row.type === 'sku' ? '#155724' : '#6c757d',
                              border: '1px solid #dee2e6',
                              background: row.type === 'sku' ? '#d4edda' : 'transparent'
                            }}>
                              {row.sku_code || '-'}
                            </td>
                            <td style={{ 
                              padding: '4px 12px',
                              verticalAlign: 'middle',
                              fontWeight: row.type === 'sku' ? '600' : '500',
                              color: row.type === 'sku' ? '#155724' : '#6c757d',
                              border: '1px solid #dee2e6',
                              background: row.type === 'sku' ? '#d4edda' : 'transparent'
                            }}>
                              {row.sku_description || '-'}
                            </td>
                            <td style={{ 
                              padding: '4px 12px',
                              verticalAlign: 'middle',
                              color: '#6c757d',
                              border: '1px solid #dee2e6'
                            }}>
                              {row.cm_code || '-'}
                            </td>
                            <td style={{ 
                              padding: '4px 12px',
                              verticalAlign: 'middle',
                              color: '#6c757d',
                              border: '1px solid #dee2e6'
                            }}>
                              {row.cm_description || '-'}
                            </td>
                            {appliedFields.length > 0 ? (
                              appliedFields.map(fieldLabel => {
                                const fieldName = componentFieldValues[fieldLabel];
                                const value = row[fieldName] || '-';
                                return (
                                  <td key={fieldLabel} style={{ 
                                    padding: '4px 12px',
                                    verticalAlign: 'middle',
                                    color: '#6c757d',
                                    border: '1px solid #dee2e6'
                                  }}>
                                    {value}
                                  </td>
                                );
                              })
                            ) : (
                              <td style={{ 
                                padding: '4px 12px',
                                verticalAlign: 'middle',
                                color: '#6c757d',
                                border: '1px solid #dee2e6',
                                textAlign: 'center',
                                fontStyle: 'italic'
                              }}>
                                Select Component Fields to see data
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </div>
                 ) : loading ? (
          <div className="row">
            <div className="col-12">
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5 className="text-muted mt-3">Fetching Data...</h5>
                <p className="text-muted">Please wait while we retrieve the filtered data from the server</p>
              </div>
            </div>
          </div>
        ) : appliedFields.length === 0 ? (
          <div className="row">
            <div className="col-12">
              <div className="text-center py-5">
              </div>
            </div>
          </div>
        ) : appliedFields.length === 0 ? (
          <div className="row">
            <div className="col-12">
              <div className="text-center py-5">
                <h5 className="text-muted">Select Component Fields</h5>
                <p className="text-muted">Please select component fields to view data in the table</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="row">
            <div className="col-12">
              <div className="text-center py-5">
                <h5 className="text-muted">No Data Found</h5>
                <p className="text-muted">No component data available for the selected criteria</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* No Data Selected Modal */}
      <ConfirmModal
        show={showNoDataModal}
        message="No data is selected. Please select at least one row before generating the PDF."
        onConfirm={handleCloseModal}
        onCancel={handleCloseModal}
      />

      {/* Max Selection Modal */}
      <ConfirmModal
        show={showMaxSelectionModal}
        message="You can select a maximum of 15 component fields. Please unselect some fields before adding new ones."
        onConfirm={handleCloseMaxSelectionModal}
        onCancel={handleCloseMaxSelectionModal}
      />

      {/* Enhanced table styles */}
      <style>{`
        .hover-row:hover {
          background-color: #f8f9fa !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .table th {
          font-weight: 600 !important;
          text-transform: uppercase;
          font-size: 0.85rem;
          letter-spacing: 0.5px;
          background-color: #f8f9fa !important;
          border-bottom: 2px solid #dee2e6 !important;
          color: #495057 !important;
          padding: 16px 12px !important;
        }
        
        .table td {
          vertical-align: middle !important;
          padding: 16px 12px !important;
          border-bottom: 1px solid #f1f3f4 !important;
          color: #495057 !important;
        }
        
        .table tbody tr {
          transition: all 0.2s ease !important;
        }
        
        .table tbody tr:hover {
          background-color: #f8f9fa !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        }
        
        .badge {
          font-weight: 500 !important;
          font-size: 0.75rem !important;
          padding: 6px 12px !important;
        }
        
        .card {
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }
        
        .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
          border-bottom: 2px solid #dee2e6 !important;
        }
        
        .form-check-input {
          border: 2px solid #dee2e6 !important;
          border-radius: 4px !important;
        }
        
        .form-check-input:checked {
          background-color: #28a745 !important;
          border-color: #28a745 !important;
        }
        
        .filter-options {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 12px;
        }
        
        .filter-options .fBold {
          color: #495057;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .filter-options input[type="checkbox"] {
          accent-color: #30ea03;
        }
        
        .filter-options label {
          color: #495057;
          font-weight: 500;
        }
        
        .btn-outline-success {
          border-color: #28a745 !important;
          color: #28a745 !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          border-radius: 6px !important;
        }
        
        .btn-outline-success:hover {
          background-color: #28a745 !important;
          color: white !important;
        }
        
        .btn-outline-success:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
        }
        }
        
        .card-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
        }
        
        .card-header h6 {
          color: white !important;
        }
        
        .table-responsive {
          border-radius: 0 0 12px 12px;
        }
        
        .form-check-input:checked {
          background-color: #30ea03 !important;
          border-color: #30ea03 !important;
        }
        
        .btn-outline-success:hover {
          background-color: #30ea03 !important;
          border-color: #30ea03 !important;
        }
        
        .filter-control, .multi-select-container, .multi-select-trigger {
          min-height: 38px !important;
          height: 38px !important;
        }
        

        .multi-select-container {
          width: 100%;
        }
        .multi-select-trigger {
          width: 100%;
        }
        .filter-group label.fBold {
          margin-bottom: 4px;
        }
        .filters .row.g-3.align-items-end > [class^='col-'] {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        
        @media (max-width: 900px) {
          .mainInternalPages { padding: 16px !important; }
          .table { font-size: 0.9rem !important; }
          .table th, .table td { padding: 8px 6px !important; }
        }
        
        @media (max-width: 600px) {
          .mainInternalPages { padding: 4px !important; }
          h1 { font-size: 1.2rem !important; }
          .mainInternalPages > div, .mainInternalPages > table { width: 100% !important; }
          .mainInternalPages label { font-size: 0.95rem !important; }
          .mainInternalPages select, .mainInternalPages input, .mainInternalPages .multi-select-container { font-size: 0.95rem !important; min-width: 0 !important; }
          .mainInternalPages .multi-select-container { width: 100% !important; }
          .mainInternalPages .multi-select-dropdown { min-width: 180px !important; }
          .mainInternalPages .multi-select-text { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-search input { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-options { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-option { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-trigger { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-dropdown { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-search { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-option .option-label { font-size: 0.95rem !important; }
          .mainInternalPages .multi-select-option .checkmark { width: 16px !important; height: 16px !important; }
          .mainInternalPages .multi-select-option input[type='checkbox'] { width: 16px !important; height: 16px !important; }
          .mainInternalPages .multi-select-dropdown { left: 0 !important; right: 0 !important; min-width: 0 !important; }
        }
      `}</style>
    </Layout>
  );
};

export default GeneratePdf; 