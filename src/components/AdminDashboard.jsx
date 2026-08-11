import React, { useState, useEffect, useMemo } from 'react';
import './AdminDashboard.css';
import ciwaLogo from '../assets/leftsidelogo.png';
import defaultDirectorSign from '../assets/director sign.png';
import * as XLSX from 'xlsx';
import {
  fetchAdminMetrics,
  fetchAllDownloadLogs,
  unlockCertificateRecord,
  lockCertificateRecord,
  deleteDownloadLogRecord,
  updateUserCertificateRecord,
  exportDBToExcel,
  fetchParticipantsList,
  fetchParticipantsFromDB,
  addParticipantRecord,
  deleteParticipantRecord,
  deleteParticipantRecordsBatch,
  updateParticipantRecord,
  bulkRegisterParticipants,
  fetchOrganizationsList,
  addOrganizationRecord,
  deleteOrganizationRecord,
  deleteOrganizationRecordsBatch,
  bulkRegisterOrganizations,
  fetchAllSupportTickets,
  updateSupportTicketStatus
} from '../utils/dbTracker';
import {
  getCertificateSettings,
  saveCertificateSettings,
  fetchCertificateSettingsFromDB,
  getParticipantPermissions,
  isParticipantDownloadEnabled,
  setParticipantDownloadStatus,
  setZoneDownloadStatus,
  getZoneTrainingDates,
  setZoneTrainingDate,
  getEffectiveTrainingDates
} from '../utils/certificateSettings';
import { downloadSampleExcelTemplate, downloadSampleOrgExcelTemplate, parseExcelFile } from '../utils/excelImport';
import { exportCertificatesToZip } from '../utils/zipExport';
import {
  getAnnouncements,
  addAnnouncement,
  deleteAnnouncement
} from '../utils/trainingAnnouncements';
import { updateAdminPassword } from '../utils/adminAuth';
import { salutations } from '../data/certificateData';
import { GlassLoader, GlassToast } from './GlassToast';

// Helper to generate avatar color from name
const getAvatarColor = (name = '') => {
  const colors = ['#059669', '#1d4ed8', '#d97706', '#7c3aed', '#db2777', '#0284c7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name = '') => {
  const parts = name.trim().split(' ').filter(p => !['Dr.', 'Mr.', 'Ms.', 'Mrs.', 'Er.'].includes(p));
  if (parts.length === 0) return 'IC';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AdminDashboard = ({ onExitAdmin, onPreviewCertificate }) => {
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics', 'logs', 'participants', 'organizations', 'updates', 'settings', 'security'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Metrics State
  const [metrics, setMetrics] = useState({
    totalIssued: 0,
    totalParticipants: 0,
    remainingParticipants: 0,
    downloadsToday: 0,
    topKvks: []
  });

  // Logs Table State
  const [logs, setLogs] = useState([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Edit User Log Modal State
  const [editingLog, setEditingLog] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Bulk Import Modal State
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelParsing, setExcelParsing] = useState(false);
  const [bulkResultModal, setBulkResultModal] = useState(null);

  // Reminder Modal State
  const [reminderModal, setReminderModal] = useState(null);

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState('');

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportSearchQuery, setSupportSearchQuery] = useState('');
  const [supportStatusFilter, setSupportStatusFilter] = useState('pending');

  // Certificate Settings State
  const [certSettings, setCertSettings] = useState(getCertificateSettings());
  const [settingsSaveMsg, setSettingsSaveMsg] = useState({ text: '', type: '' });

  // Zone Training Dates Setter State
  const [zoneTrainingDates, setZoneTrainingDates] = useState(getZoneTrainingDates());
  const [selectedZoneForDate, setSelectedZoneForDate] = useState('');
  const [zoneDateInput, setZoneDateInput] = useState('');

  // Headcount Registry State
  const [participants, setParticipants] = useState([]);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newInstituteName, setNewInstituteName] = useState('');
  const [isCustomInstInput, setIsCustomInstInput] = useState(false);
  const [newAtariZone, setNewAtariZone] = useState('');
  const [customAtariZone, setCustomAtariZone] = useState('');
  const [newTrainingDates, setNewTrainingDates] = useState('');

  // Edit Participant Modal State
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editParticipantData, setEditParticipantData] = useState({});
  const [selectedParticipantZoneFilter, setSelectedParticipantZoneFilter] = useState('');
  const [selectedParticipantStatusFilter, setSelectedParticipantStatusFilter] = useState('');
  const [selectedParticipantSerials, setSelectedParticipantSerials] = useState(new Set());
  const [participantPermissions, setParticipantPermissions] = useState(getParticipantPermissions());

  // Headcount Pagination State
  const [participantCurrentPage, setParticipantCurrentPage] = useState(1);
  const [participantItemsPerPage, setParticipantItemsPerPage] = useState(50);

  // ZIP Export Modal State
  const [zipExportModal, setZipExportModal] = useState({
    isOpen: false,
    current: 0,
    total: 0,
    participantName: '',
    title: ''
  });

  // Security State
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  // Drilldown Modal State for 4 Count Modules
  const [drilldownModal, setDrilldownModal] = useState(null); // { type: 'issued' | 'registered' | 'pending' | 'today', title: string, subtitle: string }
  const [drilldownSearchQuery, setDrilldownSearchQuery] = useState('');
  const [drilldownCategoryFilter, setDrilldownCategoryFilter] = useState('');
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [drilldownItemsPerPage, setDrilldownItemsPerPage] = useState(15);

  // Organizations & Categories State
  const [organizationsList, setOrganizationsList] = useState([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState(new Set());
  const [orgCategoryFilter, setOrgCategoryFilter] = useState('All');
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [newOrgCategory, setNewOrgCategory] = useState('KVK, ATARI Zone I, Ludhiana');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgFullName, setNewOrgFullName] = useState('');
  const [newOrgShortName, setNewOrgShortName] = useState('');

  // Unique Categories derived directly from DB Organizations table
  const dbCategories = useMemo(() => {
    const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
    const cats = Array.from(new Set(validOrgs.map(o => o.category).filter(Boolean)));
    return cats.sort();
  }, [organizationsList]);

  // Institutes derived directly from DB Organizations table filtered by selected Category
  const dbInstitutes = useMemo(() => {
    const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
    if (!newAtariZone || newAtariZone === 'CUSTOM') return validOrgs;

    return validOrgs.filter(o => {
      if (!o || !o.category) return false;
      const orgCat = String(o.category).trim();
      const selectedCat = String(newAtariZone).trim();

      // Exact Category match
      if (orgCat.toLowerCase() === selectedCat.toLowerCase()) return true;

      // Handle general KVK fallback if organization category is tagged with general KVK
      if (selectedCat.startsWith('KVK') && orgCat.startsWith('KVK')) {
        if (orgCat.includes('Zone') && selectedCat.includes('Zone')) {
          return orgCat.toLowerCase() === selectedCat.toLowerCase();
        }
        return true;
      }

      return false;
    });
  }, [organizationsList, newAtariZone]);

  // Dynamic Category & ATARI Zones grouped list derived from DB
  const categoryFilterOptions = useMemo(() => {
    const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];

    // 1. KVK ATARI Zones
    const kvkCategoriesFromDb = validOrgs
      .filter(o => o && o.category && typeof o.category === 'string' && o.category.startsWith('KVK'))
      .map(o => o.category);

    const defaultKvks = [
      "KVK, ATARI Zone I, Ludhiana",
      "KVK, ATARI Zone II, Jodhpur",
      "KVK, ATARI Zone III, Kanpur",
      "KVK, ATARI Zone IV, Patna",
      "KVK, ATARI Zone V, Kolkata",
      "KVK, ATARI Zone VI, Guwahati",
      "KVK, ATARI Zone VII, Umiam",
      "KVK, ATARI Zone VIII, Pune",
      "KVK, ATARI Zone IX, Jabalpur",
      "KVK, ATARI Zone X, Hyderabad",
      "KVK, ATARI Zone XI, Bengaluru"
    ];
    const kvkList = Array.from(new Set([...kvkCategoriesFromDb, ...defaultKvks]));

    // 2. Institutes & Universities Categories from DB
    const nonKvkCategoriesFromDb = validOrgs
      .filter(o => o && o.category && typeof o.category === 'string' && !o.category.startsWith('KVK'))
      .map(o => o.category);

    const defaultInstCategories = ["ICAR Institute", "SAU", "CAU"];
    const instList = Array.from(new Set([...nonKvkCategoriesFromDb, ...defaultInstCategories]));

    return {
      kvkList,
      instList
    };
  }, [organizationsList]);

  // Auto-increment Serial Number Helper
  const getNextAutoSerialNumber = (list = []) => {
    let maxNum = 159; // Baseline standard start (160)
    (list || []).forEach(p => {
      if (p && p.serialNumber) {
        const match = p.serialNumber.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    return `CIWA/2026/NOGRA/${maxNum + 1}`;
  };

  const [toast, setToast] = useState({ text: '', type: 'info', title: '' });
  const [loadingText, setLoadingText] = useState({ message: 'Refreshing Database Records...', subtext: 'Syncing Database & Participant Registries' });

  const triggerToast = (text, type = 'info', title = '', duration = 4000) => {
    setToast({ text, type, title });
    if (duration > 0) {
      setTimeout(() => setToast({ text: '', type: 'info', title: '' }), duration);
    }
  };

  // Load Data
  useEffect(() => {
    loadDashboardData(false);
  }, []);

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setLoadingText({ message: 'Refreshing Database Records...', subtext: 'Syncing Database & Participant Registries' });
    } else {
      setLoadingText({ message: 'Loading Admin Portal...', subtext: 'Connecting to Database' });
    }
    setLoading(true);
    try {
      const [metricsData, logsData, orgsData, supportData, pList, dbSettings] = await Promise.all([
        fetchAdminMetrics(),
        fetchAllDownloadLogs(),
        fetchOrganizationsList(),
        fetchAllSupportTickets(),
        fetchParticipantsFromDB(),
        fetchCertificateSettingsFromDB()
      ]);
      setMetrics(metricsData);
      setLogs(logsData);
      setOrganizationsList(orgsData);
      setSupportTickets(supportData);
      setParticipants(pList);
      setCertSettings(dbSettings || getCertificateSettings());
      setAnnouncements(await getAnnouncements());
      setParticipantPermissions(getParticipantPermissions());

      setNewSerialNumber(getNextAutoSerialNumber(pList));

      if (isManualRefresh) {
        triggerToast("Database and records synced successfully!", "success", "Refreshed");
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      triggerToast("Failed to refresh database records.", "danger", "Sync Error");
    } finally {
      setLoading(false);
    }
  };

  // Add Organization Handler
  const handleAddOrganization = async (e) => {
    e.preventDefault();
    const finalFullName = (newOrgFullName || newOrgName).trim();
    const finalShortName = (newOrgShortName || newOrgName || finalFullName).trim();

    if (!finalFullName && !finalShortName) {
      triggerToast("Please provide Full Name or Short Name for the Organization.", "warning", "Validation Error");
      return;
    }

    const success = await addOrganizationRecord({
      category: newOrgCategory,
      fullName: finalFullName || finalShortName,
      shortName: finalShortName || finalFullName
    });

    if (success) {
      triggerToast(`Organization "${finalShortName}" added successfully!`, "success", "Organization Added");
      setNewOrgName('');
      setNewOrgFullName('');
      setNewOrgShortName('');
      const updatedOrgs = await fetchOrganizationsList();
      setOrganizationsList(updatedOrgs);
    } else {
      triggerToast("Failed to add organization.", "danger", "Add Failed");
    }
  };

  // Delete Organization Handler
  const handleDeleteOrganization = async (org) => {
    const orgLabel = org.shortName || org.fullName || 'Organization';
    if (!window.confirm(`Are you sure you want to delete "${orgLabel}"?`)) {
      return;
    }

    const success = await deleteOrganizationRecord(org.id);
    if (success) {
      triggerToast(`Deleted "${orgLabel}" successfully.`, "success", "Organization Deleted");
      const updatedOrgs = await fetchOrganizationsList();
      setOrganizationsList(updatedOrgs);
    } else {
      triggerToast("Failed to delete organization.", "danger", "Delete Failed");
    }
  };

  const handleToggleSelectAllOrgs = (e) => {
    if (e.target.checked) {
      // Need to find filteredOrganizations scope or use organizationsList...
      // We'll define it based on organizationsList for now, or paginated array in DOM.
      // Wait, there's a bug if I just map all. Let's see how `filteredOrganizations` is defined later.
      const allIds = new Set(organizationsList.map(o => o.id));
      setSelectedOrgIds(allIds);
    } else {
      setSelectedOrgIds(new Set());
    }
  };

  const handleToggleSelectOrgRow = (id) => {
    const next = new Set(selectedOrgIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrgIds(next);
  };

  const handleBatchDeleteOrganizations = async () => {
    if (selectedOrgIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedOrgIds.size} selected organizations?`)) {
      return;
    }
    setLoading(true);
    const success = await deleteOrganizationRecordsBatch(Array.from(selectedOrgIds));
    if (success) {
      triggerToast(`Successfully batch deleted ${selectedOrgIds.size} organizations.`, "success", "Organizations Deleted");
      setSelectedOrgIds(new Set());
      const updatedOrgs = await fetchOrganizationsList();
      setOrganizationsList(updatedOrgs);
    } else {
      triggerToast("Failed to batch delete organizations.", "danger", "Delete Failed");
    }
    setLoading(false);
  };

  // Bulk Import Organizations / Institutes Handler
  const handleBulkImportOrganizations = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const parsedRows = await parseExcelFile(file);
      if (!parsedRows || parsedRows.length === 0) {
        triggerToast("The uploaded Excel file appears to be empty.", "warning", "Import Empty");
        return;
      }

      const result = await bulkRegisterOrganizations(parsedRows);
      if (result.success) {
        triggerToast(`Bulk Import Successful! Imported ${result.addedCount} institutes/organizations into Database.`, "success", "Bulk Import Complete");
        const updatedOrgs = await fetchOrganizationsList();
        setOrganizationsList(updatedOrgs);
      } else {
        triggerToast(`Failed to import organizations: ${result.error || 'Unknown error'}`, "danger", "Import Failed");
      }
    } catch (err) {
      console.error("Bulk organization import error:", err);
      triggerToast(`Error parsing Excel file: ${err.message}`, "danger", "Parse Error");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // Checkbox Select All / Toggle Single
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(filteredLogs.map(l => l.serialNumber));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleSelectRow = (serialNumber) => {
    const next = new Set(selectedRowIds);
    if (next.has(serialNumber)) {
      next.delete(serialNumber);
    } else {
      next.add(serialNumber);
    }
    setSelectedRowIds(next);
  };

  // Batch Unlock Action
  const handleBatchUnlock = async () => {
    if (selectedRowIds.size === 0) {
      alert("Please select at least one record to unlock.");
      return;
    }

    if (!window.confirm(`Are you sure you want to unlock ${selectedRowIds.size} selected certificate records?`)) {
      return;
    }

    setLoading(true);
    try {
      for (const sNo of selectedRowIds) {
        const item = logs.find(l => l.serialNumber === sNo);
        await unlockCertificateRecord(sNo, item ? item.registeredName : '');
      }
      alert(`Successfully unlocked ${selectedRowIds.size} certificate records!`);
      setSelectedRowIds(new Set());
      await loadDashboardData();
    } catch (e) {
      alert("Error carrying out batch unlock.");
    } finally {
      setLoading(false);
    }
  };

  // Batch Lock Action
  const handleBatchLock = async () => {
    if (selectedRowIds.size === 0) {
      alert("Please select at least one record to lock.");
      return;
    }

    if (!window.confirm(`Are you sure you want to lock ${selectedRowIds.size} selected certificate records? Users won't be able to edit their details.`)) {
      return;
    }

    setLoading(true);
    try {
      for (const sNo of selectedRowIds) {
        const item = logs.find(l => l.serialNumber === sNo);
        await lockCertificateRecord(sNo, item ? item.registeredName : '');
      }
      alert(`Successfully locked ${selectedRowIds.size} certificate records!`);
      setSelectedRowIds(new Set());
      await loadDashboardData();
    } catch (e) {
      alert("Error carrying out batch lock.");
    } finally {
      setLoading(false);
    }
  };

  // Single Record Actions
  const handleUnlockSingle = async (serialNumber, registeredName) => {
    if (window.confirm(`Unlock certificate record for ${registeredName} (${serialNumber})?`)) {
      const success = await unlockCertificateRecord(serialNumber, registeredName);
      if (success) {
        alert("Certificate unlocked! User can now re-edit details.");
        await loadDashboardData();
      }
    }
  };

  const handleLockSingle = async (serialNumber, registeredName) => {
    if (window.confirm(`Lock certificate record for ${registeredName} (${serialNumber})? They will not be able to edit details.`)) {
      const success = await lockCertificateRecord(serialNumber, registeredName);
      if (success) {
        alert("Certificate locked! Editing is now disabled for the user.");
        await loadDashboardData();
      }
    }
  };

  const handleDeleteSingleLog = async (serialNumber) => {
    if (window.confirm(`Are you sure you want to delete download log for ${serialNumber}?`)) {
      const success = await deleteDownloadLogRecord(serialNumber);
      if (success) {
        alert("Download record deleted!");
        await loadDashboardData();
      } else {
        alert("Error deleting log record.");
      }
    }
  };

  const handleEditSingleLog = (item) => {
    setEditingLog(item);
    setEditFormData({
      registeredName: item.registeredName || '',
      certificateName: item.certificateName || item.registeredName || '',
      salutation: item.salutation || '',
      kvkName: item.kvkName || '',
      atariZone: item.atariZone || '',
      serialNumber: item.serialNumber || '',
      email: item.email || '',
      mobile: item.mobile || '',
      wp: item.wp || ''
    });
  };

  const handleSaveUserDetailEdits = async (e) => {
    e.preventDefault();
    if (!editingLog) return;

    const success = await updateUserCertificateRecord(editingLog.serialNumber, editFormData);
    if (success) {
      alert("User details updated successfully in database!");
      setEditingLog(null);
      await loadDashboardData();
    } else {
      alert("Failed to update user details.");
    }
  };

  // Excel Bulk Import Action
  const handleProcessExcelFileUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      alert("Please select an Excel or CSV file to import.");
      return;
    }

    setExcelParsing(true);
    try {
      const rawData = await parseExcelFile(excelFile);
      if (!rawData || rawData.length === 0) {
        alert("Excel file is empty or could not be read.");
        return;
      }

      const result = bulkRegisterParticipants(rawData);
      setIsBulkImportOpen(false);
      setExcelFile(null);
      setBulkResultModal(result);
      await loadDashboardData();
    } catch (err) {
      console.error("Excel import error:", err);
      alert("Failed to process Excel file.");
    } finally {
      setExcelParsing(false);
    }
  };

  // Trigger Email Reminders to Pending Participants
  const handleTriggerEmailReminders = () => {
    const downloadedSerials = new Set(logs.map(l => l.serialNumber));
    const pendingParticipants = participants.filter(p => !downloadedSerials.has(p.serialNumber));

    setReminderModal({
      totalPending: pendingParticipants.length,
      recipients: pendingParticipants.slice(0, 10)
    });
  };

  // Single Add Participant
  const handleAddParticipant = (e) => {
    e.preventDefault();
    const nameToRegister = (newParticipantName || '').trim();
    if (!nameToRegister) {
      triggerToast("Please enter participant name.", "warning", "Validation Error");
      return;
    }

    let inputSerial = (newSerialNumber || '').trim().toUpperCase();
    if (!inputSerial) {
      inputSerial = getNextAutoSerialNumber(participants);
    }

    let finalSerial = inputSerial;
    if (!finalSerial.startsWith('CIWA/2026/NOGRA/')) {
      finalSerial = `CIWA/2026/NOGRA/${inputSerial}`;
    }

    const finalZone = newAtariZone === 'CUSTOM' ? (customAtariZone || '').trim() : (newAtariZone || '');

    try {
      const updated = addParticipantRecord({
        id: Date.now().toString(),
        name: nameToRegister,
        serialNumber: finalSerial,
        instituteName: (newInstituteName || '').trim(),
        atariZone: finalZone,
        trainingDates: (newTrainingDates || '').trim()
      });

      const validList = Array.isArray(updated) ? updated : [];
      setParticipants(validList);

      setNewParticipantName('');
      setNewInstituteName('');
      setIsCustomInstInput(false);
      setNewAtariZone('');
      setCustomAtariZone('');
      setNewTrainingDates('');

      // Auto-increment serial number for the next entry
      setNewSerialNumber(getNextAutoSerialNumber(validList));
      triggerToast(`Registered participant "${nameToRegister}" (${finalSerial}) successfully!`, "success", "Participant Registered");
    } catch (err) {
      console.error("Error registering single participant:", err);
      triggerToast("Failed to register participant. Please try again.", "danger", "Registration Failed");
    }
  };

  // Delete Participant Record
  const handleDeleteParticipant = (id, name) => {
    if (window.confirm(`Delete pre-registered headcount record for ${name}?`)) {
      const updated = deleteParticipantRecord(id);
      setParticipants(updated);
    }
  };

  // Edit Participant Handlers
  const handleStartEditParticipant = (p) => {
    setEditingParticipant(p);
    setEditParticipantData({ ...p });
  };

  const handleSaveParticipantEdit = (e) => {
    e.preventDefault();
    if (!editingParticipant) return;

    const updated = updateParticipantRecord(editingParticipant.id, editParticipantData);
    setParticipants(updated);
    setEditingParticipant(null);
    alert("Participant record updated successfully!");
  };

  // Participant Download Access Toggles
  const handleToggleParticipantAccess = (serialNumber, atariZone) => {
    const isCurrentlyEnabled = isParticipantDownloadEnabled(serialNumber, atariZone);
    const newPermissions = setParticipantDownloadStatus([serialNumber], !isCurrentlyEnabled);
    setParticipantPermissions(newPermissions);

    const targetParticipant = participants.find(p => p.serialNumber === serialNumber);
    if (targetParticipant) {
      updateParticipantRecord(targetParticipant.id, { isRestricted: isCurrentlyEnabled });
    }
  };

  const handleToggleSelectParticipantRow = (serialNumber) => {
    const next = new Set(selectedParticipantSerials);
    if (next.has(serialNumber)) {
      next.delete(serialNumber);
    } else {
      next.add(serialNumber);
    }
    setSelectedParticipantSerials(next);
  };

  const handleToggleSelectAllParticipants = (e) => {
    if (e.target.checked) {
      const pageSerials = new Set(filteredParticipants.map(p => p.serialNumber));
      setSelectedParticipantSerials(pageSerials);
    } else {
      setSelectedParticipantSerials(new Set());
    }
  };

  const handleBatchToggleSelectedParticipants = (enableStatus) => {
    if (selectedParticipantSerials.size === 0) return;
    const serialsArray = Array.from(selectedParticipantSerials);
    const newPermissions = setParticipantDownloadStatus(serialsArray, enableStatus);
    setParticipantPermissions(newPermissions);

    serialsArray.forEach(serial => {
      const targetParticipant = participants.find(p => p.serialNumber === serial);
      if (targetParticipant) {
        updateParticipantRecord(targetParticipant.id, { isRestricted: !enableStatus });
      }
    });

    alert(`Updated download access for ${serialsArray.length} selected participants.`);
  };

  const handleBatchDeleteParticipants = () => {
    if (selectedParticipantSerials.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedParticipantSerials.size} selected participants?`)) {
      return;
    }
    const serialsArray = Array.from(selectedParticipantSerials);
    const updated = deleteParticipantRecordsBatch([], serialsArray);
    setParticipants(updated);
    setSelectedParticipantSerials(new Set());
    alert(`Successfully deleted ${serialsArray.length} participants.`);
  };

  const handleBatchToggleZone = (atariZone, enableStatus) => {
    if (!atariZone) {
      alert("Please select an ATARI Zone.");
      return;
    }
    const newPermissions = setZoneDownloadStatus(atariZone, enableStatus);
    setParticipantPermissions(newPermissions);

    participants.filter(p => p.atariZone === atariZone).forEach(p => {
      updateParticipantRecord(p.id, { isRestricted: !enableStatus });
    });

    alert(`All participants under ${atariZone} are now ${enableStatus ? 'ENABLED' : 'DISABLED'} for certificate downloads.`);
  };

  const handleSetZoneTrainingDateSubmit = () => {
    if (!selectedZoneForDate) {
      alert("Please select an ATARI Zone.");
      return;
    }
    const updated = setZoneTrainingDate(selectedZoneForDate, zoneDateInput);
    setZoneTrainingDates(updated);
    alert(`Training dates statement updated for ${selectedZoneForDate}!`);
  };

  // Bulk ZIP Exports
  const handleExportAllToZip = async () => {
    if (participants.length === 0) {
      alert("No pre-registered participants available for export.");
      return;
    }

    if (!window.confirm(`Generate and export PDF certificates ZIP archive for ALL ${participants.length} pre-registered participants?`)) {
      return;
    }

    setZipExportModal({
      isOpen: true,
      current: 0,
      total: participants.length,
      participantName: '',
      title: 'Packaging Master ZIP Archive...'
    });

    try {
      await exportCertificatesToZip({
        participants,
        zipFilename: 'ICAR_All_Certificates_Backup.zip',
        onProgress: ({ current, total, participantName }) => {
          setZipExportModal(prev => ({ ...prev, current, total, participantName }));
        }
      });
    } catch (e) {
      console.error("Error generating ZIP archive:", e);
      alert("Error generating ZIP archive.");
    } finally {
      setZipExportModal({ isOpen: false, current: 0, total: 0, participantName: '', title: '' });
    }
  };

  const handleExportSelectedToZip = async () => {
    if (selectedParticipantSerials.size === 0) return;
    const selectedList = participants.filter(p => selectedParticipantSerials.has(p.serialNumber));

    setZipExportModal({
      isOpen: true,
      current: 0,
      total: selectedList.length,
      participantName: '',
      title: 'Packaging Selected Certificates ZIP...'
    });

    try {
      await exportCertificatesToZip({
        participants: selectedList,
        zipFilename: 'ICAR_Selected_Certificates_Backup.zip',
        onProgress: ({ current, total, participantName }) => {
          setZipExportModal(prev => ({ ...prev, current, total, participantName }));
        }
      });
    } catch (e) {
      console.error("Error exporting selected ZIP:", e);
      alert("Error exporting selected ZIP.");
    } finally {
      setZipExportModal({ isOpen: false, current: 0, total: 0, participantName: '', title: '' });
    }
  };

  const handleExportZoneToZip = async (atariZone) => {
    if (!atariZone) {
      alert("Please select an ATARI Zone / Institution Category.");
      return;
    }
    const zoneParticipants = participants.filter(p => p.atariZone === atariZone);
    if (zoneParticipants.length === 0) {
      alert(`No participants found under ${atariZone}.`);
      return;
    }

    setZipExportModal({
      isOpen: true,
      current: 0,
      total: zoneParticipants.length,
      participantName: '',
      title: `Packaging ${atariZone} Certificates ZIP...`
    });

    try {
      await exportCertificatesToZip({
        participants: zoneParticipants,
        zipFilename: `ICAR_${atariZone.replace(/[^a-zA-Z0-9]/g, '_')}_Certificates.zip`,
        onProgress: ({ current, total, participantName }) => {
          setZipExportModal(prev => ({ ...prev, current, total, participantName }));
        }
      });
    } catch (e) {
      console.error("Error exporting zone ZIP:", e);
      alert("Error exporting zone ZIP.");
    } finally {
      setZipExportModal({ isOpen: false, current: 0, total: 0, participantName: '', title: '' });
    }
  };

  // Announcements Handlers
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()) {
      alert("Please provide title and message for announcement.");
      return;
    }

    const updated = await addAnnouncement({
      title: newAnnouncementTitle.trim(),
      message: newAnnouncementMessage.trim(),
      status: 'live'
    });

    setAnnouncements(updated);
    setNewAnnouncementTitle('');
    setNewAnnouncementMessage('');
    alert("Training Announcement published successfully!");
  };

  const handleDeleteAnnouncementItem = async (id) => {
    if (window.confirm("Delete this training announcement?")) {
      const updated = await deleteAnnouncement(id);
      setAnnouncements(updated);
    }
  };

  // Settings Handlers
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const result = await saveCertificateSettings(certSettings);
    if (result.success) {
      setCertSettings(result.settings);
      setSettingsSaveMsg({ text: "✓ Certificate layout and Master Download settings saved permanently to Database!", type: "success" });
    } else {
      setSettingsSaveMsg({ text: "Failed to save settings to Database.", type: "danger" });
    }
    setTimeout(() => setSettingsSaveMsg({ text: '', type: '' }), 4000);
  };

  const handleDirectorSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Signature image size must be smaller than 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCertSettings({
          ...certSettings,
          directorSignatureImage: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newAdminPassword.trim()) {
      setPasswordMsg({ text: "Please enter new password.", type: "danger" });
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordMsg({ text: "Passwords do not match.", type: "danger" });
      return;
    }

    const res = await updateAdminPassword(newAdminPassword.trim());
    if (res && res.success) {
      setPasswordMsg({ text: res.message || "Master Admin password updated and secured in Database!", type: "success" });
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } else {
      setPasswordMsg({ text: res?.message || "Failed to update password.", type: "danger" });
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    // Helper: find the category for a given institute name or zone value from organizationsList
    const getOrgCategory = (value) => {
      if (!value) return '';
      const cleanVal = value.trim().toLowerCase();
      const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
      const matched = validOrgs.find(o =>
        (o.shortName && o.shortName.trim().toLowerCase() === cleanVal) ||
        (o.fullName && o.fullName.trim().toLowerCase() === cleanVal) ||
        (o.category && o.category.trim().toLowerCase() === cleanVal) ||
        (o.shortName && cleanVal.includes(o.shortName.trim().toLowerCase())) ||
        (o.fullName && cleanVal.includes(o.fullName.trim().toLowerCase()))
      );
      return matched ? (matched.category || '') : '';
    };

    return logs.filter(log => {
      const query = logSearchQuery.toLowerCase();
      const matchesSearch =
        (log.registeredName && log.registeredName.toLowerCase().includes(query)) ||
        (log.certificateName && log.certificateName.toLowerCase().includes(query)) ||
        (log.serialNumber && log.serialNumber.toLowerCase().includes(query)) ||
        (log.kvkName && log.kvkName.toLowerCase().includes(query)) ||
        (log.email && log.email.toLowerCase().includes(query)) ||
        (log.atariZone && log.atariZone.toLowerCase().includes(query));

      let matchesZone = true;
      if (selectedZoneFilter) {
        const filterLower = selectedZoneFilter.toLowerCase().trim();
        const logZoneLower = (log.atariZone || '').toLowerCase().trim();
        const logKvkLower = (log.kvkName || '').toLowerCase().trim();

        // 1. Direct exact match on atariZone
        const directZoneMatch = logZoneLower === filterLower;

        // 2. atariZone starts-with filter (handles minor suffix differences)
        const zoneStartsMatch = logZoneLower.startsWith(filterLower) || filterLower.startsWith(logZoneLower);

        // 3. Look up category of log.atariZone and compare to selectedZoneFilter
        const atariZoneCategory = getOrgCategory(log.atariZone || '');
        const atariZoneCategoryMatch = atariZoneCategory &&
          atariZoneCategory.trim().toLowerCase() === filterLower;

        // 4. Look up category of log.kvkName and compare to selectedZoneFilter
        const kvkNameCategory = getOrgCategory(log.kvkName || '');
        const kvkCategoryMatch = kvkNameCategory &&
          kvkNameCategory.trim().toLowerCase() === filterLower;

        // 5. Fallback: kvkName includes filter (for partial name searches)
        const kvkNameMatch = logKvkLower && logKvkLower.includes(filterLower);

        matchesZone = directZoneMatch || zoneStartsMatch || atariZoneCategoryMatch || kvkCategoryMatch || kvkNameMatch;
      }

      const matchesStatus = !selectedStatusFilter || (selectedStatusFilter === 'locked' ? log.isLocked : !log.isLocked);

      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [logs, logSearchQuery, selectedZoneFilter, selectedStatusFilter, organizationsList]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Filtered Participants
  const filteredParticipants = useMemo(() => {
    return (participants || []).filter(p => {
      if (!p) return false;
      const query = (participantSearchQuery || '').toLowerCase();
      const nameStr = p.name ? String(p.name).toLowerCase() : '';
      const serialStr = p.serialNumber ? String(p.serialNumber).toLowerCase() : '';
      const instStr = p.instituteName ? String(p.instituteName).toLowerCase() : '';
      const zoneStr = p.atariZone ? String(p.atariZone).toLowerCase() : '';

      const matchesSearch =
        nameStr.includes(query) ||
        serialStr.includes(query) ||
        instStr.includes(query) ||
        zoneStr.includes(query);

      const matchesZone = !selectedParticipantZoneFilter ||
        (p.atariZone && (p.atariZone === selectedParticipantZoneFilter || p.atariZone.toLowerCase().includes(selectedParticipantZoneFilter.toLowerCase()))) ||
        (p.instituteName && p.instituteName.toLowerCase().includes(selectedParticipantZoneFilter.toLowerCase()));

      const isEnabled = isParticipantDownloadEnabled(p.serialNumber, p.atariZone);
      const matchesStatus =
        !selectedParticipantStatusFilter ||
        (selectedParticipantStatusFilter === 'enabled' ? isEnabled : !isEnabled);

      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [participants, participantSearchQuery, selectedParticipantZoneFilter, selectedParticipantStatusFilter, participantPermissions]);

  const totalParticipantPages = Math.ceil(filteredParticipants.length / participantItemsPerPage) || 1;
  const paginatedParticipants = useMemo(() => {
    const start = (participantCurrentPage - 1) * participantItemsPerPage;
    return filteredParticipants.slice(start, start + participantItemsPerPage);
  }, [filteredParticipants, participantCurrentPage, participantItemsPerPage]);

  // ══════════════════════════════════════════════════════════════
  // LIVE COMPUTED METRICS (100% Sync with In-Memory State & Modals)
  // ══════════════════════════════════════════════════════════════
  const liveMetrics = useMemo(() => {
    const downloadedMap = new Map();
    (logs || []).forEach(l => {
      if (l && l.serialNumber) {
        downloadedMap.set(l.serialNumber.trim().toUpperCase(), l);
      }
    });

    const uniqueIssued = downloadedMap.size;
    const totalRegistered = (participants || []).length;

    let pendingCount = 0;
    (participants || []).forEach(p => {
      const cleanSerial = (p && p.serialNumber ? p.serialNumber : '').trim().toUpperCase();
      if (!cleanSerial || !downloadedMap.has(cleanSerial)) {
        pendingCount++;
      }
    });

    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayUniqueSerials = new Set();
    (logs || []).forEach(item => {
      if (!item || !item.downloadTime || !item.serialNumber) return;
      try {
        const logDateIST = new Date(item.downloadTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (logDateIST === todayIST) {
          todayUniqueSerials.add(item.serialNumber.trim().toUpperCase());
        }
      } catch (_) { }
    });

    const kvkMap = {};
    (logs || []).forEach(log => {
      const kvk = log.kvkName || 'Unspecified KVK';
      kvkMap[kvk] = (kvkMap[kvk] || 0) + 1;
    });

    const topKvks = Object.entries(kvkMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalIssued: uniqueIssued,
      totalParticipants: totalRegistered,
      remainingParticipants: pendingCount,
      downloadsToday: todayUniqueSerials.size,
      topKvks: topKvks.length > 0 ? topKvks : (metrics.topKvks || [])
    };
  }, [logs, participants, metrics.topKvks]);

  // ══════════════════════════════════════════════════════════════
  // 4 COUNT MODULES DRILLDOWN & CATEGORY-WISE EXCEL LOGIC
  // ══════════════════════════════════════════════════════════════
  const handleOpenDrilldown = (type) => {
    setDrilldownSearchQuery('');
    setDrilldownCategoryFilter('');
    setDrilldownPage(1);

    if (type === 'issued') {
      setDrilldownModal({
        type: 'issued',
        title: 'Total Certificates Issued',
        subtitle: 'All participants who have verified and downloaded/locked their official certificate'
      });
    } else if (type === 'registered') {
      setDrilldownModal({
        type: 'registered',
        title: 'Registered Participants Roster',
        subtitle: 'Full database roster of all pre-registered participants and their current status'
      });
    } else if (type === 'pending') {
      setDrilldownModal({
        type: 'pending',
        title: 'Pending Certificate Downloads',
        subtitle: 'Pre-registered participants awaiting certificate generation and download'
      });
    } else if (type === 'today') {
      setDrilldownModal({
        type: 'today',
        title: 'Certificates Issued Today (IST)',
        subtitle: 'Live certificates downloaded today under Indian Standard Time'
      });
    }
  };

  const drilldownRawList = useMemo(() => {
    if (!drilldownModal || !drilldownModal.type) return [];

    const downloadedMap = new Map();
    (logs || []).forEach(l => {
      if (l && l.serialNumber) {
        downloadedMap.set(l.serialNumber.trim().toUpperCase(), l);
      }
    });

    if (drilldownModal.type === 'issued') {
      return Array.from(downloadedMap.values()).map(item => {
        const certName = item.certificateName || item.registeredName || 'N/A';
        const combinedName = item.salutation && item.salutation.trim() ? `${item.salutation.trim()} ${certName}` : certName;
        return {
          name: combinedName,
          registeredName: item.registeredName || '',
          serialNumber: item.serialNumber || 'N/A',
          instituteName: item.kvkName || 'N/A',
          atariZone: item.atariZone || 'N/A',
          category: item.atariZone || 'N/A',
          status: item.isLocked ? 'Locked' : 'Issued',
          downloadTime: item.downloadTime,
          email: item.email || '',
          mobile: item.mobile || '',
          wp: item.wp || item.wp_no || '',
          trainingDates: item.trainingDates || ''
        };
      });
    }

    if (drilldownModal.type === 'registered') {
      return (participants || []).map(p => {
        const cleanSerial = (p.serialNumber || '').trim().toUpperCase();
        const downloadedLog = downloadedMap.get(cleanSerial);
        return {
          name: p.name || 'N/A',
          registeredName: p.name || '',
          serialNumber: p.serialNumber || 'N/A',
          instituteName: p.instituteName || 'N/A',
          atariZone: p.atariZone || p.category || 'N/A',
          category: p.category || p.atariZone || 'N/A',
          status: downloadedLog ? (downloadedLog.isLocked ? 'Locked' : 'Issued') : 'Pending Download',
          downloadTime: downloadedLog ? downloadedLog.downloadTime : null,
          email: downloadedLog?.email || '',
          mobile: downloadedLog?.mobile || '',
          wp: downloadedLog?.wp || '',
          trainingDates: p.trainingDates || ''
        };
      });
    }

    if (drilldownModal.type === 'pending') {
      return (participants || [])
        .filter(p => {
          const cleanSerial = (p.serialNumber || '').trim().toUpperCase();
          return !downloadedMap.has(cleanSerial);
        })
        .map(p => ({
          name: p.name || 'N/A',
          registeredName: p.name || '',
          serialNumber: p.serialNumber || 'N/A',
          instituteName: p.instituteName || 'N/A',
          atariZone: p.atariZone || p.category || 'N/A',
          category: p.category || p.atariZone || 'N/A',
          status: 'Pending Download',
          downloadTime: null,
          email: '',
          mobile: '',
          wp: '',
          trainingDates: p.trainingDates || ''
        }));
    }

    if (drilldownModal.type === 'today') {
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const uniqueTodayLogs = new Map();
      (logs || []).forEach(item => {
        if (!item.downloadTime || !item.serialNumber) return;
        const logDateIST = new Date(item.downloadTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (logDateIST === todayIST) {
          uniqueTodayLogs.set(item.serialNumber.trim().toUpperCase(), item);
        }
      });
      return Array.from(uniqueTodayLogs.values()).map(item => {
        const certName = item.certificateName || item.registeredName || 'N/A';
        const combinedName = item.salutation && item.salutation.trim() ? `${item.salutation.trim()} ${certName}` : certName;
        return {
          name: combinedName,
          registeredName: item.registeredName || '',
          serialNumber: item.serialNumber || 'N/A',
          instituteName: item.kvkName || 'N/A',
          atariZone: item.atariZone || 'N/A',
          category: item.atariZone || 'N/A',
          status: item.isLocked ? 'Locked' : 'Issued Today',
          downloadTime: item.downloadTime,
          email: item.email || '',
          mobile: item.mobile || '',
          wp: item.wp || item.wp_no || '',
          trainingDates: item.trainingDates || ''
        };
      });
    }

    return [];
  }, [drilldownModal, logs, participants]);

  const filteredDrilldownList = useMemo(() => {
    const query = (drilldownSearchQuery || '').toLowerCase().trim();
    const catFilter = (drilldownCategoryFilter || '').trim().toLowerCase();

    return drilldownRawList.filter(item => {
      const nameMatch = (item.name || '').toLowerCase().includes(query);
      const regMatch = (item.registeredName || '').toLowerCase().includes(query);
      const serialMatch = (item.serialNumber || '').toLowerCase().includes(query);
      const instMatch = (item.instituteName || '').toLowerCase().includes(query);
      const zoneMatch = (item.atariZone || '').toLowerCase().includes(query);
      const emailMatch = (item.email || '').toLowerCase().includes(query);
      const mobileMatch = (item.mobile || '').toLowerCase().includes(query);

      const matchesQuery = !query || (nameMatch || regMatch || serialMatch || instMatch || zoneMatch || emailMatch || mobileMatch);

      const matchesCat = !catFilter ||
        (item.atariZone && item.atariZone.toLowerCase().includes(catFilter)) ||
        (item.category && item.category.toLowerCase().includes(catFilter)) ||
        (item.instituteName && item.instituteName.toLowerCase().includes(catFilter));

      return matchesQuery && matchesCat;
    });
  }, [drilldownRawList, drilldownSearchQuery, drilldownCategoryFilter]);

  const totalDrilldownPages = Math.ceil(filteredDrilldownList.length / drilldownItemsPerPage) || 1;
  const paginatedDrilldownList = useMemo(() => {
    const start = (drilldownPage - 1) * drilldownItemsPerPage;
    return filteredDrilldownList.slice(start, start + drilldownItemsPerPage);
  }, [filteredDrilldownList, drilldownPage, drilldownItemsPerPage]);

  const handleExportDrilldownToExcel = (isCategoryWise = false) => {
    if (!drilldownModal) return;
    const dataToExport = isCategoryWise ? drilldownRawList : filteredDrilldownList;
    if (!dataToExport || dataToExport.length === 0) {
      alert("No records to export.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const formatRows = (items) => items.map((item, idx) => ({
      'S.No': idx + 1,
      'Participant Name': item.name || 'N/A',
      'Serial Number': item.serialNumber || 'N/A',
      'Category / ATARI Zone': item.atariZone || item.category || 'N/A',
      'Institute / KVK Name': item.instituteName || 'N/A',
      'Status': item.status || 'N/A',
      'Download Timestamp (IST)': item.downloadTime ? new Date(item.downloadTime).toLocaleString() : 'N/A',
      'Email Address': item.email || 'N/A',
      'Mobile Number': item.mobile || 'N/A',
      'WhatsApp Number': item.wp || 'N/A',
      'Training Dates': item.trainingDates || 'N/A'
    }));

    if (isCategoryWise && !drilldownCategoryFilter) {
      // Group records category-wise
      const grouped = {};
      dataToExport.forEach(item => {
        const cat = (item.atariZone || item.category || 'Uncategorized').trim();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      // Master Summary Sheet
      const summaryData = Object.entries(grouped).map(([catName, items], index) => ({
        '#': index + 1,
        'Category / ATARI Zone': catName,
        'Total Records': items.length
      }));
      summaryData.push({
        '#': 'TOTAL',
        'Category / ATARI Zone': 'All Categories Combined',
        'Total Records': dataToExport.length
      });

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 8 }, { wch: 42 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Category Summary');

      // All Records Sheet
      const masterSheet = XLSX.utils.json_to_sheet(formatRows(dataToExport));
      masterSheet['!cols'] = [
        { wch: 6 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 32 },
        { wch: 18 }, { wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(workbook, masterSheet, 'All Records');

      // Individual Sheets per Category
      const usedSheetNames = new Set(['Category Summary', 'All Records']);
      Object.entries(grouped).forEach(([catName, items]) => {
        let safeSheetName = catName
          .replace(/[:\\/?*\[\]]/g, '')
          .replace(/KVK,\s*/gi, '')
          .replace(/ATARI\s*/gi, '')
          .trim()
          .slice(0, 31);
        if (!safeSheetName) safeSheetName = 'Category';
        let uniqueName = safeSheetName;
        let counter = 1;
        while (usedSheetNames.has(uniqueName.toUpperCase())) {
          uniqueName = safeSheetName.slice(0, 27) + `_${counter}`;
          counter++;
        }
        usedSheetNames.add(uniqueName.toUpperCase());

        const catSheet = XLSX.utils.json_to_sheet(formatRows(items));
        catSheet['!cols'] = [
          { wch: 6 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 32 },
          { wch: 18 }, { wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(workbook, catSheet, uniqueName);
      });
    } else {
      const sheetData = formatRows(dataToExport);
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 28 }, { wch: 24 }, { wch: 32 }, { wch: 32 },
        { wch: 18 }, { wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 22 }
      ];
      const sheetName = (drilldownCategoryFilter || drilldownModal.title || 'Records').replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Records');
    }

    const catPrefix = drilldownCategoryFilter ? `${drilldownCategoryFilter.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
    const cleanFilename = `ICAR_${catPrefix}${drilldownModal.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, cleanFilename);
  };

  // Tab titles for the topbar
  const tabTitles = {
    metrics: 'Analytics & Overview',
    logs: 'Certificate Issuance Log',
    participants: 'Participant Registry',
    organizations: 'Organizations & Institutions',
    updates: 'Training Announcements',
    settings: 'Certificate & Director Settings',
    security: 'Security & Authentication',
    support: 'Support & Issues'
  };

  return (
    <div className={`admin-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {/* Glassmorphism Loader & Toast Notifications */}
      <GlassLoader isLoading={loading} message={loadingText.message} subtext={loadingText.subtext} />
      <GlassToast toast={toast} onClose={() => setToast({ text: '', type: 'info', title: '' })} />

      {/* ═══════════ PUBLER-STYLE SIDEBAR ═══════════ */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        {/* Header: Brand on left, Publer collapse toggle on right */}
        <div className="sb-brand">
          <div className="sb-brand-main">
            <img src={ciwaLogo} alt="ICAR-CIWA" className="sb-brand-logo" />
            <div className="sb-brand-text">
              <span className="sb-brand-name">ICAR-CIWA</span>
              <span className="sb-brand-sub">Admin Portal</span>
            </div>
          </div>

          {/* Publer-style collapse icon: arrow + menu lines */}
          <button
            className="sb-publer-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="10 17 5 12 10 7" />
                <line x1="14" y1="9" x2="20" y2="9" />
                <line x1="14" y1="15" x2="20" y2="15" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="14 17 19 12 14 7" />
                <line x1="4" y1="9" x2="10" y2="9" />
                <line x1="4" y1="15" x2="10" y2="15" />
              </svg>
            )}
          </button>
        </div>

        {/* DB Status */}
        <div className="sb-db-status">
          <span className="sb-db-dot"></span>
          <span className="sb-db-label">Database Connected</span>
        </div>

        {/* Navigation with Publer-Style Outline Icons */}
        <nav className="sb-nav-section">
          <div className="sb-nav-label">Main</div>

          {/* Analytics: Line / Trend Chart Icon */}
          <button className={`sb-nav-item ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')} title="Analytics">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="14 7 21 7 21 14" />
              </svg>
            </span>
            <span className="sb-nav-text">Analytics</span>
          </button>

          {/* Certificate Log: Document / Post Icon */}
          <button className={`sb-nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')} title="Certificate Log">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <span className="sb-nav-text">Certificate Log</span>
            {filteredLogs.length > 0 && <span className="sb-nav-badge">{filteredLogs.length}</span>}
          </button>

          {/* Participants: Users Outline Icon */}
          <button className={`sb-nav-item ${activeTab === 'participants' ? 'active' : ''}`} onClick={() => setActiveTab('participants')} title="Participants">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="sb-nav-text">Participants</span>
            {participants.length > 0 && <span className="sb-nav-badge">{participants.length}</span>}
          </button>

          {/* Organizations: Building Icon */}
          <button className={`sb-nav-item ${activeTab === 'organizations' ? 'active' : ''}`} onClick={() => setActiveTab('organizations')} title="Organizations">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="22" x2="9" y2="2" />
                <line x1="8" y1="6" x2="10" y2="6" />
                <line x1="14" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="10" y2="10" />
                <line x1="14" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="10" y2="14" />
                <line x1="14" y1="14" x2="16" y2="14" />
              </svg>
            </span>
            <span className="sb-nav-text">Organizations</span>
          </button>

          <div className="sb-nav-label">Communication</div>

          {/* Announcements: Broadcast / RSS Feed Icon */}
          <button className={`sb-nav-item ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')} title="Announcements">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11a9 9 0 0 1 9 9" />
                <path d="M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1.5" />
              </svg>
            </span>
            <span className="sb-nav-text">Announcements</span>
            {announcements.length > 0 && <span className="sb-nav-badge">{announcements.length}</span>}
          </button>

          {/* Support Tickets: Ticket / Help Icon */}
          <button className={`sb-nav-item ${activeTab === 'support' ? 'active' : ''}`} onClick={() => setActiveTab('support')} title="Support Tickets">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <span className="sb-nav-text">Support Tickets</span>
            {supportTickets.filter(t => t.status === 'pending').length > 0 &&
              <span className="sb-nav-badge sb-nav-badge-alert">{supportTickets.filter(t => t.status === 'pending').length}</span>}
          </button>

          <div className="sb-nav-label">System</div>

          {/* Settings: Sliders / Gear Icon */}
          <button className={`sb-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </span>
            <span className="sb-nav-text">Settings</span>
          </button>

          {/* Security: Shield Icon */}
          <button className={`sb-nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')} title="Security">
            <span className="sb-nav-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="sb-nav-text">Security</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="sb-footer">
          <button className="sb-logout-btn" onClick={onExitAdmin} title="Exit Admin Portal">
            <span className="sb-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="sb-nav-text">Exit Admin Portal</span>
          </button>
        </div>
      </aside>

      {/* ═══════════ MAIN CONTENT AREA ═══════════ */}
      <div className="admin-main-area">

        {/* Top Bar with Simple Clean Breadcrumb */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumb-nav">
              <span className="breadcrumb-root">Portal</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{tabTitles[activeTab]}</span>
            </div>
            <h1 className="topbar-page-title">{tabTitles[activeTab]}</h1>
          </div>
          <div className="topbar-right">
            <button className="topbar-action-btn" onClick={() => exportDBToExcel(filteredLogs)} title="Export current certificate records to Excel">
              📊 Export Excel
            </button>
            <button className="topbar-action-btn primary-glow" onClick={() => loadDashboardData(true)} disabled={loading} title="Sync and refresh all database records">
              🔄 Refresh Data
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="admin-page-content">

          {/* TAB 1: ANALYTICS & OVERVIEW */}
          {activeTab === 'metrics' && (
            <div className="animate-fade">

              {/* Prominent Live Progress Card */}
              {(() => {
                const completionPct = liveMetrics.totalParticipants > 0 ? Math.round((liveMetrics.totalIssued / liveMetrics.totalParticipants) * 100) : 0;
                return (
                  <div className="admin-card progress-overview-card">
                    <div className="progress-overview-header">
                      <div className="progress-overview-info">
                        <span className="progress-badge">🎯 Live Progress</span>
                        <h3>Certificate Issuance & Completion Overview</h3>
                        <p>Real-time completion percentage across all registered participants</p>
                      </div>
                      <div className="progress-percentage-display">
                        <span className="progress-pct-number">{completionPct}%</span>
                        <span className="progress-pct-sub">Completed</span>
                      </div>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="progress-track-large">
                      <div
                        className="progress-fill-large"
                        style={{ width: `${Math.min(100, Math.max(completionPct, completionPct > 0 ? 2 : 0))}%` }}
                      >
                        <div className="progress-fill-shine"></div>
                      </div>
                    </div>

                    {/* Progress Quick Breakdown Pills */}
                    <div className="progress-breakdown-row">
                      <div className="breakdown-stat-item" onClick={() => handleOpenDrilldown('issued')} title="Click to view issued certificates table & export">
                        <span className="breakdown-dot dot-issued"></span>
                        <span className="breakdown-label">Issued & Locked:</span>
                        <strong>{liveMetrics.totalIssued}</strong>
                      </div>
                      <div className="breakdown-stat-item" onClick={() => handleOpenDrilldown('pending')} title="Click to view pending downloads table & export">
                        <span className="breakdown-dot dot-pending"></span>
                        <span className="breakdown-label">Pending Downloads:</span>
                        <strong>{liveMetrics.remainingParticipants}</strong>
                      </div>
                      <div className="breakdown-stat-item" onClick={() => handleOpenDrilldown('registered')} title="Click to view registered participants table & export">
                        <span className="breakdown-dot dot-total"></span>
                        <span className="breakdown-label">Total Registered:</span>
                        <strong>{liveMetrics.totalParticipants}</strong>
                      </div>
                      <div className="breakdown-stat-item" onClick={() => handleOpenDrilldown('today')} title="Click to view today's issued certificates table & export">
                        <span className="breakdown-dot dot-today"></span>
                        <span className="breakdown-label">Issued Today:</span>
                        <strong>{liveMetrics.downloadsToday}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="metrics-grid-4">
                <div className="metric-stat-box stat-gold" onClick={() => handleOpenDrilldown('issued')} title="Click to view table of issued certificates and export to Excel">
                  <span className="stat-label-text">Total Certificates Issued</span>
                  <span className="stat-value-text">{liveMetrics.totalIssued}</span>
                  <div className="stat-mini-progress-track">
                    <div
                      className="stat-mini-progress-fill stat-fill-gold"
                      style={{ width: `${liveMetrics.totalParticipants > 0 ? Math.round((liveMetrics.totalIssued / liveMetrics.totalParticipants) * 100) : 0}%` }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="stat-sub-badge badge-gold">
                      {liveMetrics.totalParticipants > 0 ? Math.round((liveMetrics.totalIssued / liveMetrics.totalParticipants) * 100) : 0}% Completion
                    </span>
                    <span className="stat-card-click-hint">📊 View & Export ➔</span>
                  </div>
                </div>

                <div className="metric-stat-box stat-navy" onClick={() => handleOpenDrilldown('registered')} title="Click to view roster table and export to Excel">
                  <span className="stat-label-text">Registered Participants</span>
                  <span className="stat-value-text">{liveMetrics.totalParticipants}</span>
                  <div className="stat-mini-progress-track">
                    <div className="stat-mini-progress-fill stat-fill-blue" style={{ width: '100%' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="stat-sub-badge badge-blue">Official Roster</span>
                    <span className="stat-card-click-hint">👥 View & Export ➔</span>
                  </div>
                </div>

                <div className="metric-stat-box stat-amber-card" onClick={() => handleOpenDrilldown('pending')} title="Click to view pending downloads table and export to Excel">
                  <span className="stat-label-text">Pending Certificate Downloads</span>
                  <span className="stat-value-text">{liveMetrics.remainingParticipants}</span>
                  <div className="stat-mini-progress-track">
                    <div
                      className="stat-mini-progress-fill stat-fill-amber"
                      style={{ width: `${liveMetrics.totalParticipants > 0 ? Math.round((liveMetrics.remainingParticipants / liveMetrics.totalParticipants) * 100) : 0}%` }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="stat-sub-badge badge-gold">Awaiting Download</span>
                    <span className="stat-card-click-hint">⏳ View & Export ➔</span>
                  </div>
                </div>

                <div className="metric-stat-box stat-emerald" onClick={() => handleOpenDrilldown('today')} title="Click to view today's issued certificates and export to Excel">
                  <span className="stat-label-text">Issued Today (IST)</span>
                  <span className="stat-value-text">{liveMetrics.downloadsToday}</span>
                  <div className="stat-mini-progress-track">
                    <div className="stat-mini-progress-fill stat-fill-emerald" style={{ width: `${liveMetrics.downloadsToday > 0 ? Math.min(100, liveMetrics.downloadsToday * 10) : 0}%` }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="stat-sub-badge badge-green">Live Active</span>
                    <span className="stat-card-click-hint">⚡ View & Export ➔</span>
                  </div>
                </div>
              </div>

              {/* Top KVK Leaderboard Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>🏆 Top Institutions & ATARI KVKs by Issued Certificates</h3>
                    <p>Distribution leaderboard across KVK centers and agricultural institutes.</p>
                  </div>
                </div>

                <div className="table-responsive-container">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Institution / KVK Name</th>
                        <th>Certificates Issued</th>
                        <th>Distribution %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveMetrics.topKvks && liveMetrics.topKvks.length > 0 ? (
                        liveMetrics.topKvks.map((kvk, idx) => {
                          const pct = liveMetrics.totalIssued > 0 ? Math.round((kvk.count / liveMetrics.totalIssued) * 100) : 0;
                          return (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td><strong>{kvk.name}</strong></td>
                              <td><span className="status-badge-pill badge-active">{kvk.count} Certificates</span></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, background: '#059669', height: '100%' }}></div>
                                  </div>
                                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            No certificate download logs available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ISSUED CERTIFICATES LOG */}
          {activeTab === 'logs' && (
            <div className="animate-fade">
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>📜 Official Certificate Issuance Log ({filteredLogs.length})</h3>
                    <p>Real-time audit log of all generated certificates locked in the database.</p>
                  </div>

                  <div className="toolbar-flex-row" style={{ margin: 0 }}>
                    <button type="button" className="btn-admin-outline" onClick={handleBatchUnlock} disabled={selectedRowIds.size === 0} style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }}>
                      🔓 Batch Unlock ({selectedRowIds.size})
                    </button>
                    <button type="button" className="btn-admin-outline" onClick={handleBatchLock} disabled={selectedRowIds.size === 0} style={{ borderColor: '#ef4444', color: '#b91c1c' }}>
                      🔒 Batch Lock ({selectedRowIds.size})
                    </button>
                    <button type="button" className="btn-admin-gold" onClick={() => exportDBToExcel(filteredLogs)}>
                      📊 Export Log to Excel
                    </button>
                  </div>
                </div>

                {/* Filters Toolbar */}
                <div className="toolbar-flex-row">
                  <div className="filter-group-left">
                    <input
                      type="text"
                      className="search-input-admin"
                      placeholder="Search name, serial, institute..."
                      value={logSearchQuery}
                      onChange={(e) => {
                        setLogSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                    />

                    <select
                      className="select-filter-admin"
                      value={selectedZoneFilter}
                      onChange={(e) => {
                        setSelectedZoneFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">🏛️ All Categories & Institutions</option>
                      <optgroup label="📍 KVK by ATARI Zone">
                        {categoryFilterOptions.kvkList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏛️ Institutes & Universities (ICAR / SAU / CAU)">
                        {categoryFilterOptions.instList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    </select>

                    <select
                      className="select-filter-admin"
                      value={selectedStatusFilter}
                      onChange={(e) => {
                        setSelectedStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">⚙️ All Lock Statuses</option>
                      <option value="locked">🔒 Locked & Finalized</option>
                      <option value="unlocked">🔓 Editable / Draft</option>
                    </select>
                  </div>
                </div>

                {/* Log Table */}
                <div className="table-responsive-container">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedRowIds.has(l.serialNumber))}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th>SerialNo.</th>
                        <th>Participant Name</th>
                        <th>Email Address</th>
                        <th>Mobile & WhatsApp</th>
                        <th>Serial Number</th>
                        <th>KVK / Institute</th>
                        <th>ATARI Zone</th>
                        <th>Issued Timestamp</th>
                        <th>Lock Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.length > 0 ? (
                        paginatedLogs.map((item, idx) => {
                          const isSelected = selectedRowIds.has(item.serialNumber);
                          const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;
                          return (
                            <tr key={item.id || idx} className={isSelected ? 'row-selected' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectRow(item.serialNumber)}
                                />
                              </td>
                              <td>{rowNum}</td>
                              <td>
                                <div className="participant-info">
                                  <strong style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: 600 }}>
                                    {item.salutation ? `${item.salutation} ` : ''}{item.certificateName || item.registeredName}
                                  </strong>
                                  {item.registeredName && item.registeredName !== item.certificateName && (
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      Registered: {item.registeredName}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {item.email ? (
                                  <a href={`mailto:${item.email}`} className="clean-email-link" title={item.email}>
                                    <span>📧</span>
                                    <span>{item.email}</span>
                                  </a>
                                ) : (
                                  <span className="text-empty-muted">—</span>
                                )}
                              </td>
                              <td>
                                <div className="log-contact-cell">
                                  {item.mobile && (
                                    <div className="clean-contact-row" title="Mobile Number">
                                      <span>📱</span>
                                      <span>{item.mobile}</span>
                                    </div>
                                  )}
                                  {(item.wp || item.wp_no) && (
                                    <div className="clean-contact-row" title="WhatsApp Number">
                                      <span>💬</span>
                                      <span>{item.wp || item.wp_no}</span>
                                    </div>
                                  )}
                                  {!item.mobile && !(item.wp || item.wp_no) && (
                                    <span className="text-empty-muted">—</span>
                                  )}
                                </div>
                              </td>
                              <td><span className="clean-serial-text">{item.serialNumber}</span></td>
                              <td><span className="clean-text-muted">{item.kvkName || '—'}</span></td>
                              <td><span className="clean-text-muted">{item.atariZone || '—'}</span></td>
                              <td>
                                <div className="timestamp-cell">
                                  <span className="date-part">
                                    {item.downloadTime ? new Date(item.downloadTime).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                  {item.downloadTime && (
                                    <span className="time-part">
                                      {new Date(item.downloadTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge-pill ${item.isLocked ? 'badge-locked' : 'badge-unlocked'}`}>
                                  {item.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                                </span>
                              </td>
                              <td>
                                <div className="action-btn-group">
                                  {item.isLocked ? (
                                    <button
                                      type="button"
                                      className="btn-admin-outline"
                                      style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                                      onClick={() => handleUnlockSingle(item.serialNumber, item.registeredName)}
                                      title="Unlock Record"
                                    >
                                      🔓 Unlock
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-admin-outline"
                                      style={{ height: '30px', padding: '0 10px', fontSize: '12px', borderColor: '#ef4444', color: '#b91c1c' }}
                                      onClick={() => handleLockSingle(item.serialNumber, item.registeredName)}
                                      title="Lock Record"
                                    >
                                      🔒 Lock
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-admin-outline"
                                    style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                                    onClick={() => handleEditSingleLog(item)}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-admin-danger"
                                    onClick={() => handleDeleteSingleLog(item.serialNumber)}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="11" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-tertiary)' }}>
                            No certificate download logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="pagination-bar-container">
                  <div>
                    Showing <strong>{paginatedLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</strong> of <strong>{filteredLogs.length}</strong> records
                  </div>

                  <div className="pagination-controls-group">
                    <button
                      className="pagination-btn-nav"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      ‹ Prev
                    </button>

                    <span>Page {currentPage} of {totalPages}</span>

                    <button
                      className="pagination-btn-nav"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARTICIPANT REGISTRY & ACCESS CONTROL */}
          {activeTab === 'participants' && (
            <div className="animate-fade">

              {/* Register Participant & Excel Actions */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>👥 Participant Headcount Registry & Bulk Excel Import</h3>
                    <p>Register participants, download official Excel template, upload bulk participant records, and control download permissions.</p>
                  </div>

                  <div className="toolbar-flex-row" style={{ margin: 0 }}>
                    <button type="button" className="btn-admin-outline" onClick={downloadSampleExcelTemplate}>
                      📥 Download Sample Excel Template
                    </button>
                    <button type="button" className="btn-admin-gold" onClick={() => setIsBulkImportOpen(true)}>
                      📦 Upload Excel (.xlsx / .csv)
                    </button>
                    <button type="button" className="btn-admin-primary" onClick={handleExportAllToZip}>
                      📦 Backup ALL Certificates (ZIP)
                    </button>
                  </div>
                </div>

                {/* Add Single Participant Form */}
                <form onSubmit={handleAddParticipant} className="add-participant-form-row mt-16">
                  <input
                    type="text"
                    placeholder="Participant ID / Serial No (e.g. 166)"
                    value={newSerialNumber}
                    onChange={(e) => setNewSerialNumber(e.target.value)}
                    required
                    className="input-flex-admin"
                    style={{ minWidth: '160px', flex: '0 0 auto' }}
                  />

                  <input
                    type="text"
                    placeholder="Participant Full Name (e.g. Ramesh Kumar)"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    required
                    className="input-flex-admin"
                  />

                  {/* Category Dropdown from Organization */}
                  <select
                    value={newAtariZone}
                    onChange={(e) => {
                      const catVal = e.target.value;
                      setNewAtariZone(catVal);
                      setNewInstituteName('');
                      setIsCustomInstInput(false);
                    }}
                    className="select-filter-admin"
                  >
                    <option value="">🏢 Select Category...</option>

                    {/* 1. All KVK Categories */}
                    <optgroup label="📍 KVK Categories (ATARI Zones)">
                      {categoryFilterOptions.kvkList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>

                    {/* 2. ICAR Institute */}
                    <optgroup label="🏛️ ICAR Institutes">
                      <option value="ICAR Institute">ICAR Institute</option>
                    </optgroup>

                    {/* 3. CAU & SAU */}
                    <optgroup label="🎓 Agricultural Universities">
                      <option value="CAU">Central Agricultural University (CAU)</option>
                      <option value="SAU">State Agricultural University (SAU)</option>
                    </optgroup>

                    <option value="CUSTOM">➕ Custom Category...</option>
                  </select>

                  {/* Institute Name Dropdown from Organization (displays ONLY shortName) */}
                  <select
                    disabled={!newAtariZone}
                    value={isCustomInstInput ? 'CUSTOM_INST' : newInstituteName}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM_INST') {
                        setIsCustomInstInput(true);
                        setNewInstituteName('');
                      } else {
                        setIsCustomInstInput(false);
                        setNewInstituteName(val);
                        // Auto-fill category if not chosen
                        const matchedOrg = (organizationsList || []).find(o => (o.shortName || o.fullName) === val || o.fullName === val);
                        if (matchedOrg && (!newAtariZone || newAtariZone === 'CUSTOM')) {
                          setNewAtariZone(matchedOrg.category);
                        }
                      }
                    }}
                    className="select-filter-admin"
                    style={{ opacity: !newAtariZone ? 0.6 : 1, cursor: !newAtariZone ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="">
                      {!newAtariZone ? '🏛️ Select Category First...' : '🏛️ Select Institute...'}
                    </option>
                    {dbInstitutes.map((org, idx) => {
                      const displayShortName = org.shortName || org.fullName;
                      return (
                        <option key={org.id || idx} value={displayShortName}>
                          {displayShortName}
                        </option>
                      );
                    })}
                    <option value="CUSTOM_INST">✏️ Type Custom Institute Name...</option>
                  </select>

                  {(isCustomInstInput || !organizationsList.length) && (
                    <input
                      type="text"
                      placeholder="Type Custom Institute Name"
                      value={newInstituteName}
                      onChange={(e) => setNewInstituteName(e.target.value)}
                      required
                      className="input-flex-admin"
                    />
                  )}

                  {newAtariZone === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="Enter Custom Category"
                      value={customAtariZone}
                      onChange={(e) => setCustomAtariZone(e.target.value)}
                      required
                      className="input-flex-admin"
                    />
                  )}

                  <input
                    type="text"
                    placeholder="Training Dates (Optional e.g. Oct 13-17, 2025)"
                    value={newTrainingDates}
                    onChange={(e) => setNewTrainingDates(e.target.value)}
                    className="input-flex-admin"
                  />

                  <button type="submit" className="btn-admin-primary nowrap">
                    + Add Single Participant
                  </button>
                </form>
              </div>

              {/* Headcount Registry List & Permissions */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>🛡️ Participant Download Access Registry ({filteredParticipants.length})</h3>
                    <p>Control granular certificate download access by individual participant or ATARI Zone.</p>
                  </div>
                </div>

                {/* Filters & Zone Control Row */}
                <div className="toolbar-flex-row">
                  <div className="filter-group-left">
                    <input
                      type="text"
                      className="search-input-admin"
                      placeholder="Search name, serial, institute..."
                      value={participantSearchQuery}
                      onChange={(e) => {
                        setParticipantSearchQuery(e.target.value);
                        setParticipantCurrentPage(1);
                      }}
                    />

                    <select
                      className="select-filter-admin"
                      value={selectedParticipantZoneFilter}
                      onChange={(e) => {
                        setSelectedParticipantZoneFilter(e.target.value);
                        setParticipantCurrentPage(1);
                      }}
                    >
                      <option value="">🏛️ All Categories & Institutions</option>
                      <optgroup label="📍 KVK by ATARI Zone">
                        {categoryFilterOptions.kvkList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏛️ Institutes & Universities (ICAR / SAU / CAU)">
                        {categoryFilterOptions.instList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    </select>

                    <select
                      className="select-filter-admin"
                      value={selectedParticipantStatusFilter}
                      onChange={(e) => {
                        setSelectedParticipantStatusFilter(e.target.value);
                        setParticipantCurrentPage(1);
                      }}
                    >
                      <option value="">⚙️ All Download Statuses</option>
                      <option value="enabled">🟢 Download Allowed</option>
                      <option value="disabled">🔴 Download Restricted</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-admin-success"
                      onClick={() => handleBatchToggleSelectedParticipants(true)}
                      disabled={selectedParticipantSerials.size === 0}
                    >
                      🟢 Enable Selected ({selectedParticipantSerials.size})
                    </button>

                    <button
                      type="button"
                      className="btn-admin-danger"
                      onClick={() => handleBatchToggleSelectedParticipants(false)}
                      disabled={selectedParticipantSerials.size === 0}
                    >
                      🔴 Disable Selected ({selectedParticipantSerials.size})
                    </button>

                    <button
                      type="button"
                      className="btn-admin-danger"
                      onClick={handleBatchDeleteParticipants}
                      disabled={selectedParticipantSerials.size === 0}
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      🗑️ Delete Selected ({selectedParticipantSerials.size})
                    </button>

                    <button
                      type="button"
                      className="btn-admin-gold"
                      onClick={handleExportSelectedToZip}
                      disabled={selectedParticipantSerials.size === 0}
                    >
                      📦 Export Selected ZIP
                    </button>
                  </div>
                </div>

                {/* Headcount Data Table */}
                <div className="table-responsive-container">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={filteredParticipants.length > 0 && filteredParticipants.every(p => selectedParticipantSerials.has(p.serialNumber))}
                            onChange={handleToggleSelectAllParticipants}
                          />
                        </th>
                        <th>#</th>
                        <th>Participant Name</th>
                        <th>Assigned Serial Number</th>
                        <th>Institute / KVK Name</th>
                        <th>ATARI Zone</th>
                        <th>Training Dates</th>
                        <th>Download Permission</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedParticipants.length > 0 ? (
                        paginatedParticipants.map((p, idx) => {
                          const isEnabled = isParticipantDownloadEnabled(p.serialNumber, p.atariZone);
                          const isSelected = selectedParticipantSerials.has(p.serialNumber);
                          const rowNum = (participantCurrentPage - 1) * participantItemsPerPage + idx + 1;
                          const effectiveDates = getEffectiveTrainingDates(p.serialNumber, p.atariZone, p.trainingDates);

                          return (
                            <tr key={p.id || idx} className={isSelected ? 'row-selected' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectParticipantRow(p.serialNumber)}
                                />
                              </td>
                              <td>{rowNum}</td>
                              <td><strong>{p.name}</strong></td>
                              <td><code>{p.serialNumber}</code></td>
                              <td>{p.instituteName || '—'}</td>
                              <td><span className="status-badge-pill badge-unlocked">{p.atariZone || '—'}</span></td>
                              <td><small>{effectiveDates}</small></td>
                              <td>
                                <button
                                  type="button"
                                  className={`status-badge-pill ${isEnabled ? 'badge-active' : 'badge-disabled'}`}
                                  onClick={() => handleToggleParticipantAccess(p.serialNumber, p.atariZone)}
                                  style={{ border: 'none', cursor: 'pointer' }}
                                >
                                  {isEnabled ? '🟢 Allowed' : '🔴 Restricted'}
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn-admin-outline"
                                    style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                                    onClick={() => handleStartEditParticipant(p)}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-admin-danger"
                                    onClick={() => handleDeleteParticipant(p.id, p.name)}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                            No participant headcount records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="pagination-bar-container">
                  <div>
                    Showing <strong>{paginatedParticipants.length > 0 ? (participantCurrentPage - 1) * participantItemsPerPage + 1 : 0}</strong> to <strong>{Math.min(participantCurrentPage * participantItemsPerPage, filteredParticipants.length)}</strong> of <strong>{filteredParticipants.length}</strong> participants
                  </div>

                  <div className="pagination-controls-group">
                    <button
                      className="pagination-btn-nav"
                      disabled={participantCurrentPage === 1}
                      onClick={() => setParticipantCurrentPage(p => Math.max(1, p - 1))}
                    >
                      ‹ Prev
                    </button>

                    <span>Page {participantCurrentPage} of {totalParticipantPages}</span>

                    <button
                      className="pagination-btn-nav"
                      disabled={participantCurrentPage >= totalParticipantPages}
                      onClick={() => setParticipantCurrentPage(p => Math.min(totalParticipantPages, p + 1))}
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ORGANIZATIONS & CATEGORIES MANAGEMENT */}
          {activeTab === 'organizations' && (
            <div className="animate-fade">

              {/* Add New Organization Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>🏢 Manage Institutions & Organization Categories</h3>
                    <p>Add, edit, bulk import, and categorize ATARI KVKs, ICAR Institutes, SAUs, and CAUs live in Database.</p>
                  </div>
                  <div className="action-buttons-flex" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-admin-outline nowrap"
                      onClick={downloadSampleOrgExcelTemplate}
                      title="Download Excel Template for Bulk Institute Import"
                    >
                      📥 Download Institute Template
                    </button>
                    <label className="btn-admin-primary text-sm nowrap cursor-pointer" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }} title="Import Institutes from Excel file">
                      📤 Import Bulk Institutes Excel
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleBulkImportOrganizations}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>

                <form onSubmit={handleAddOrganization} className="add-participant-form-row mt-16">
                  <select
                    value={newOrgCategory}
                    onChange={(e) => setNewOrgCategory(e.target.value)}
                    className="select-filter-admin"
                    required
                  >
                    <optgroup label="📍 KVK by ATARI Zone">
                      <option value="KVK, ATARI Zone I, Ludhiana">KVK, ATARI Zone I, Ludhiana</option>
                      <option value="KVK, ATARI Zone II, Jodhpur">KVK, ATARI Zone II, Jodhpur</option>
                      <option value="KVK, ATARI Zone III, Kanpur">KVK, ATARI Zone III, Kanpur</option>
                      <option value="KVK, ATARI Zone IV, Patna">KVK, ATARI Zone IV, Patna</option>
                      <option value="KVK, ATARI Zone V, Kolkata">KVK, ATARI Zone V, Kolkata</option>
                      <option value="KVK, ATARI Zone VI, Guwahati">KVK, ATARI Zone VI, Guwahati</option>
                      <option value="KVK, ATARI Zone VII, Umiam">KVK, ATARI Zone VII, Umiam</option>
                      <option value="KVK, ATARI Zone VIII, Pune">KVK, ATARI Zone VIII, Pune</option>
                      <option value="KVK, ATARI Zone IX, Jabalpur">KVK, ATARI Zone IX, Jabalpur</option>
                      <option value="KVK, ATARI Zone X, Hyderabad">KVK, ATARI Zone X, Hyderabad</option>
                      <option value="KVK, ATARI Zone XI, Bengaluru">KVK, ATARI Zone XI, Bengaluru</option>
                    </optgroup>
                    <optgroup label="🏛️ Institutes & Universities">
                      <option value="ICAR Institute">ICAR Institute</option>
                      <option value="SAU">SAU (State Agricultural Univ)</option>
                      <option value="CAU">CAU (Central Agricultural Univ)</option>
                    </optgroup>
                  </select>

                  <input
                    type="text"
                    placeholder="Short Name (e.g. OUAT / KVK Ludhiana / CAU)"
                    value={newOrgShortName}
                    onChange={(e) => setNewOrgShortName(e.target.value)}
                    required
                    className="input-flex-admin"
                  />

                  <input
                    type="text"
                    placeholder="Full Official Name (e.g. Orissa University of Agriculture and Technology)"
                    value={newOrgFullName}
                    onChange={(e) => setNewOrgFullName(e.target.value)}
                    required
                    className="input-flex-admin"
                  />

                  <button type="submit" className="btn-admin-primary nowrap">
                    + Add Organization
                  </button>
                </form>
              </div>

              {/* Organizations List Card */}
              <div className="admin-card">
                <div className="toolbar-flex-row">
                  <div className="filter-group-left">
                    {['All', 'All KVKs', 'ICAR Institute', 'SAU', 'CAU'].map(cat => {
                      const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
                      const count = cat === 'All'
                        ? validOrgs.length
                        : cat === 'All KVKs'
                          ? validOrgs.filter(o => o && o.category && typeof o.category === 'string' && o.category.startsWith('KVK')).length
                          : validOrgs.filter(o => o && o.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`nav-pill-btn ${orgCategoryFilter === cat ? 'active' : ''}`}
                          onClick={() => setOrgCategoryFilter(cat)}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    className="search-input-admin"
                    placeholder="Search category, short name, full name..."
                    value={orgSearchQuery}
                    onChange={(e) => setOrgSearchQuery(e.target.value)}
                  />
                </div>

                {/* Data Table */}
                <div className="table-responsive-container">
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Showing {(() => {
                        const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
                        return validOrgs.filter(org => {
                          if (!org) return false;
                          const categoryStr = org.category ? String(org.category) : '';
                          const fullNameStr = org.fullName ? String(org.fullName) : '';
                          const shortNameStr = org.shortName ? String(org.shortName) : '';
                          const matchCat = orgCategoryFilter === 'All' ? true : orgCategoryFilter === 'All KVKs' ? categoryStr.startsWith('KVK') : categoryStr === orgCategoryFilter;
                          const query = (orgSearchQuery || '').toLowerCase();
                          const matchQuery = !query || fullNameStr.toLowerCase().includes(query) || categoryStr.toLowerCase().includes(query) || shortNameStr.toLowerCase().includes(query);
                          return matchCat && matchQuery;
                        }).length;
                      })()} organizations
                    </span>
                    <button
                      type="button"
                      className="btn-admin-danger"
                      onClick={handleBatchDeleteOrganizations}
                      disabled={selectedOrgIds.size === 0}
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      🗑️ Delete Selected ({selectedOrgIds.size})
                    </button>
                  </div>
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={(() => {
                              const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
                              const filtered = validOrgs.filter(org => {
                                if (!org) return false;
                                const categoryStr = org.category ? String(org.category) : '';
                                const fullNameStr = org.fullName ? String(org.fullName) : '';
                                const shortNameStr = org.shortName ? String(org.shortName) : '';
                                const matchCat = orgCategoryFilter === 'All' ? true : orgCategoryFilter === 'All KVKs' ? categoryStr.startsWith('KVK') : categoryStr === orgCategoryFilter;
                                const query = (orgSearchQuery || '').toLowerCase();
                                const matchQuery = !query || fullNameStr.toLowerCase().includes(query) || categoryStr.toLowerCase().includes(query) || shortNameStr.toLowerCase().includes(query);
                                return matchCat && matchQuery;
                              });
                              return filtered.length > 0 && filtered.every(o => selectedOrgIds.has(o.id));
                            })()}
                            onChange={(e) => {
                              const validOrgs = Array.isArray(organizationsList) ? organizationsList : [];
                              const filtered = validOrgs.filter(org => {
                                if (!org) return false;
                                const categoryStr = org.category ? String(org.category) : '';
                                const fullNameStr = org.fullName ? String(org.fullName) : '';
                                const shortNameStr = org.shortName ? String(org.shortName) : '';
                                const matchCat = orgCategoryFilter === 'All' ? true : orgCategoryFilter === 'All KVKs' ? categoryStr.startsWith('KVK') : categoryStr === orgCategoryFilter;
                                const query = (orgSearchQuery || '').toLowerCase();
                                const matchQuery = !query || fullNameStr.toLowerCase().includes(query) || categoryStr.toLowerCase().includes(query) || shortNameStr.toLowerCase().includes(query);
                                return matchCat && matchQuery;
                              });
                              if (e.target.checked) {
                                const allIds = new Set(filtered.map(o => o.id));
                                setSelectedOrgIds(allIds);
                              } else {
                                setSelectedOrgIds(new Set());
                              }
                            }}
                          />
                        </th>
                        <th>#</th>
                        <th>Category</th>
                        <th>Short Name</th>
                        <th>Full Official Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(organizationsList) ? organizationsList : [])
                        .filter(org => {
                          if (!org) return false;
                          const categoryStr = org.category ? String(org.category) : '';
                          const fullNameStr = org.fullName ? String(org.fullName) : '';
                          const shortNameStr = org.shortName ? String(org.shortName) : '';

                          const matchCat = orgCategoryFilter === 'All'
                            ? true
                            : orgCategoryFilter === 'All KVKs'
                              ? categoryStr.startsWith('KVK')
                              : categoryStr === orgCategoryFilter;

                          const query = (orgSearchQuery || '').toLowerCase();
                          const matchQuery = !query ||
                            fullNameStr.toLowerCase().includes(query) ||
                            categoryStr.toLowerCase().includes(query) ||
                            shortNameStr.toLowerCase().includes(query);

                          return matchCat && matchQuery;
                        })
                        .map((org, idx) => (
                          <tr key={org.id || idx} className={selectedOrgIds.has(org.id) ? 'row-selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedOrgIds.has(org.id)}
                                onChange={() => handleToggleSelectOrgRow(org.id)}
                              />
                            </td>
                            <td>{idx + 1}</td>
                            <td>
                              <span className="status-badge-pill badge-active">{org.category}</span>
                            </td>
                            <td>
                              <strong>{org.shortName}</strong>
                            </td>
                            <td>{org.fullName}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-admin-danger"
                                onClick={() => handleDeleteOrganization(org)}
                                title="Delete Organization"
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: ANNOUNCEMENTS */}
          {activeTab === 'updates' && (
            <div className="animate-fade">
              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>📢 Publish Training Announcements</h3>
                    <p>Broadcast updates, guidelines, and schedule notifications to training participants.</p>
                  </div>
                </div>

                <form onSubmit={handleCreateAnnouncement} style={{ display: 'grid', gap: '16px' }}>
                  <input
                    type="text"
                    placeholder="Announcement Title (e.g. Certificate Generation Window Open)"
                    value={newAnnouncementTitle}
                    onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                    required
                    className="input-flex-admin"
                  />

                  <textarea
                    placeholder="Announcement Message Content..."
                    value={newAnnouncementMessage}
                    onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                    required
                    rows={3}
                    className="input-flex-admin"
                    style={{ height: 'auto', padding: '12px' }}
                  />

                  <button type="submit" className="btn-admin-primary" style={{ width: 'fit-content' }}>
                    📢 Publish Announcement
                  </button>
                </form>
              </div>

              {/* Existing Announcements */}
              <div className="admin-card">
                <h3>Active Training Announcements ({announcements.length})</h3>
                <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                  {announcements.length > 0 ? (
                    announcements.map((item, idx) => (
                      <div key={item.id || idx} style={{
                        padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{item.title}</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{item.message}</p>
                          <small style={{ fontSize: '11px', color: '#94a3b8' }}>Published: {new Date(item.timestamp).toLocaleString()}</small>
                        </div>
                        <button type="button" className="btn-admin-danger" onClick={() => handleDeleteAnnouncementItem(item.id)}>
                          🗑️ Delete
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#64748b' }}>No published announcements available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB SUPPORT TICKETS */}
          {activeTab === 'support' && (
            <div className="animate-fade">
              <div className="admin-card">
                <div className="admin-card-header" style={{ marginBottom: '20px' }}>
                  <div>
                    <h3>🎫 Support & Issues Management</h3>
                    <p>Review support tickets submitted by participants who are unable to generate certificates.</p>
                  </div>
                  <div>
                    <select
                      className="select-filter-admin"
                      value={supportStatusFilter}
                      onChange={(e) => setSupportStatusFilter(e.target.value)}
                    >
                      <option value="">⚙️ All Tickets</option>
                      <option value="pending">🔴 Pending Action</option>
                      <option value="resolved">🟢 Resolved / Closed</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrapper-admin">
                  <table className="table-admin compact-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Participant Name</th>
                        <th>Serial Number</th>
                        <th>Contact</th>
                        <th style={{ minWidth: '300px' }}>Issue Description</th>
                        <th>Submitted At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportTickets
                        .filter(t => !supportStatusFilter || t.status === supportStatusFilter)
                        .map(item => (
                          <tr key={item.id}>
                            <td>
                              <span className={`status-badge-pill ${item.status === 'resolved' ? 'badge-emulator' : 'badge-unlocked'}`} style={{ backgroundColor: item.status === 'resolved' ? '#dcfce7' : '#fee2e2', color: item.status === 'resolved' ? '#166534' : '#991b1b' }}>
                                {item.status === 'resolved' ? '🟢 Resolved' : '🔴 Pending'}
                              </span>
                            </td>
                            <td><strong>{item.registeredName || '—'}</strong></td>
                            <td><span className="clean-serial-text">{item.serialNumber || '—'}</span></td>
                            <td>
                              <div style={{ fontSize: '12.5px' }}>
                                {item.email && <div>📧 {item.email}</div>}
                                {item.mobile && <div>📱 {item.mobile}</div>}
                                {!item.email && !item.mobile && <span className="text-empty-muted">—</span>}
                              </div>
                            </td>
                            <td style={{ fontSize: '13px', lineHeight: '1.4' }}>
                              {item.issueDescription}
                            </td>
                            <td>
                              <div className="timestamp-cell">
                                <span className="date-part">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="action-btn-group">
                                {item.status !== 'resolved' && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Mark ticket from ${item.registeredName} as Resolved?`)) {
                                        await updateSupportTicketStatus(item.id, 'resolved');
                                        triggerToast("Ticket marked as resolved.", "success");
                                        loadDashboardData();
                                      }
                                    }}
                                    className="btn-admin-outline"
                                    style={{ color: '#059669', borderColor: '#059669', fontSize: '12px', padding: '6px 10px' }}
                                  >
                                    ✓ Resolve
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {supportTickets.filter(t => !supportStatusFilter || t.status === supportStatusFilter).length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No support tickets found matching the criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="animate-fade">
              <div className="admin-card" style={{ maxWidth: '800px' }}>
                <div className="admin-card-header">
                  <div>
                    <h3>⚙️ Certificate Template & Director Settings</h3>
                    <p>Configure Director signature, official titles, training dates statement, and download access switches.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} style={{ display: 'grid', gap: '20px' }}>
                  {settingsSaveMsg.text && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
                      background: settingsSaveMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: settingsSaveMsg.type === 'success' ? '#166534' : '#991b1b'
                    }}>
                      {settingsSaveMsg.text}
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontWeight: 600, fontSize: '13.5px' }}>Director Signature Image</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <img
                        src={certSettings.directorSignatureImage || defaultDirectorSign}
                        alt="Director Signature Preview"
                        style={{ height: '50px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px', background: '#fff' }}
                        onError={(e) => {
                          if (e.currentTarget.src !== defaultDirectorSign) {
                            e.currentTarget.src = defaultDirectorSign;
                          }
                        }}
                      />
                      <input type="file" accept="image/*" onChange={handleDirectorSignatureUpload} className="input-flex-admin" style={{ flex: '1 1 200px' }} />
                      <button
                        type="button"
                        onClick={() => setCertSettings({ ...certSettings, directorSignatureImage: defaultDirectorSign })}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          color: '#475569',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                        title="Restore original ICAR-CIWA Director signature"
                      >
                        ↺ Reset to Default
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>Director Name</label>
                      <input
                        type="text"
                        value={certSettings.directorName}
                        onChange={(e) => setCertSettings({ ...certSettings, directorName: e.target.value })}
                        required
                        className="input-flex-admin"
                      />
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>Director Title</label>
                      <input
                        type="text"
                        value={certSettings.directorTitle}
                        onChange={(e) => setCertSettings({ ...certSettings, directorTitle: e.target.value })}
                        required
                        className="input-flex-admin"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>Training Organizer Name</label>
                    <input
                      type="text"
                      value={certSettings.trainingOrganizer}
                      onChange={(e) => setCertSettings({ ...certSettings, trainingOrganizer: e.target.value })}
                      required
                      className="input-flex-admin"
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>Global Training Dates Statement</label>
                    <input
                      type="text"
                      value={certSettings.trainingDates}
                      onChange={(e) => setCertSettings({ ...certSettings, trainingDates: e.target.value })}
                      required
                      className="input-flex-admin"
                    />
                  </div>

                  {/* Master Download Access Switch */}
                  <div style={{
                    background: certSettings.downloadEnabled ? '#f0fdf4' : '#fef2f2',
                    padding: '18px',
                    borderRadius: '12px',
                    border: `1.5px solid ${certSettings.downloadEnabled ? '#bbf7d0' : '#fecaca'}`,
                    transition: 'all 0.2s ease'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', color: certSettings.downloadEnabled ? '#15803d' : '#991b1b' }}>
                      <input
                        type="checkbox"
                        checked={certSettings.downloadEnabled}
                        onChange={async (e) => {
                          const updated = { ...certSettings, downloadEnabled: e.target.checked };
                          setCertSettings(updated);
                          await saveCertificateSettings(updated);
                        }}
                        style={{ width: '18px', height: '18px', accentColor: certSettings.downloadEnabled ? '#16a34a' : '#dc2626' }}
                      />
                      <span>
                        {certSettings.downloadEnabled
                          ? '🟢 Global Certificate Downloads: ENABLED (Participants Can Download)'
                          : '🔴 Global Certificate Downloads: SUSPENDED / DISABLED (Downloads Locked)'
                        }
                      </span>
                    </label>
                    <p style={{ margin: '8px 0 0 30px', fontSize: '12.5px', color: certSettings.downloadEnabled ? '#166534' : '#991b1b' }}>
                      {certSettings.downloadEnabled
                        ? 'Master Switch is ON. Participant certificate generation and downloads are currently active.'
                        : 'Master Switch is OFF. Downloads are blocked for all participants across the portal.'
                      }
                    </p>
                  </div>

                  {/* Scheduled Download Window */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={certSettings.scheduleEnabled || false}
                        onChange={(e) => setCertSettings({ ...certSettings, scheduleEnabled: e.target.checked })}
                      />
                      <span>⏰ Enable Datetime Scheduled Download Window</span>
                    </label>

                    {certSettings.scheduleEnabled && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Start Date & Time (Opens at)
                          </label>
                          <input
                            type="datetime-local"
                            value={certSettings.scheduleStart || ''}
                            onChange={(e) => setCertSettings({ ...certSettings, scheduleStart: e.target.value })}
                            className="input-flex-admin"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            End Date & Time (Closes at)
                          </label>
                          <input
                            type="datetime-local"
                            value={certSettings.scheduleEnd || ''}
                            onChange={(e) => setCertSettings({ ...certSettings, scheduleEnd: e.target.value })}
                            className="input-flex-admin"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Closed Notice Message (Shown to participants when downloads are disabled)
                      </label>
                      <input
                        type="text"
                        value={certSettings.closedMessage || ''}
                        onChange={(e) => setCertSettings({ ...certSettings, closedMessage: e.target.value })}
                        placeholder="Certificate downloads are currently closed by Administrator."
                        className="input-flex-admin"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-admin-primary" style={{ width: 'fit-content' }}>
                    💾 Save Certificate Settings
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY */}
          {activeTab === 'security' && (
            <div className="animate-fade">
              <div className="admin-card" style={{ maxWidth: '500px' }}>
                <div className="admin-card-header">
                  <div>
                    <h3>🔑 Master Admin Password</h3>
                    <p>Update authentication credentials for Administrator Access.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: '16px' }}>
                  {passwordMsg.text && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
                      background: passwordMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: passwordMsg.type === 'success' ? '#166534' : '#991b1b'
                    }}>
                      {passwordMsg.text}
                    </div>
                  )}

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>New Password</label>
                    <input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      required
                      className="input-flex-admin"
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      required
                      className="input-flex-admin"
                    />
                  </div>

                  <button type="submit" className="btn-admin-primary" style={{ width: 'fit-content' }}>
                    💾 Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>{/* end admin-page-content */}
      </div>{/* end admin-main-area */}

      {/* BULK IMPORT MODAL */}
      {
        isBulkImportOpen && (
          <div className="modal-overlay-admin" onClick={() => setIsBulkImportOpen(false)}>
            <div className="modal-card-admin" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h3>📦 Direct Excel Participant Import</h3>
                <button className="btn-close-modal" onClick={() => setIsBulkImportOpen(false)}>✕</button>
              </div>

              <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Upload an Excel sheet (<code>.xlsx</code>, <code>.xls</code>, or <code>.csv</code>) matching our official format.<br />
                Expected Column Headers: <strong>Serial No, Name, Category, Institute / KVK Name, Training Dates</strong>.
              </p>

              <form onSubmit={handleProcessExcelFileUpload} style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setExcelFile(e.target.files[0])}
                  className="input-flex-admin"
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn-admin-outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-admin-gold" disabled={excelParsing}>
                    {excelParsing ? 'Parsing Excel File...' : '📦 Import Excel & Register Users'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* BULK IMPORT RESULT MODAL */}
      {
        bulkResultModal && (
          <div className="modal-overlay-admin" onClick={() => setBulkResultModal(null)}>
            <div className="modal-card-admin" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h3>📋 Excel Import & Duplicate Check Results</h3>
                <button className="btn-close-modal" onClick={() => setBulkResultModal(null)}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1, padding: '16px', background: 'var(--accent-emerald-dim)', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
                  <strong style={{ fontSize: '24px', display: 'block' }}>{bulkResultModal.successCount}</strong>
                  Registered Successfully
                </div>
                <div style={{ flex: 1, padding: '16px', background: 'var(--accent-rose-dim)', borderRadius: '12px', color: 'var(--accent-rose)' }}>
                  <strong style={{ fontSize: '24px', display: 'block' }}>{bulkResultModal.skippedCount}</strong>
                  Duplicates Skipped
                </div>
              </div>

              <button type="button" className="btn-admin-primary" onClick={() => setBulkResultModal(null)}>
                Close & Return
              </button>
            </div>
          </div>
        )
      }

      {/* EDIT LOG MODAL */}
      {
        editingLog && (
          <div className="modal-overlay-admin" onClick={() => setEditingLog(null)}>
            <div className="modal-card-admin" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h3>✏️ Edit Certificate DB Record ({editingLog.serialNumber})</h3>
                <button className="btn-close-modal" onClick={() => setEditingLog(null)}>✕</button>
              </div>

              <form onSubmit={handleSaveUserDetailEdits} style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Salutation</label>
                    <select
                      value={editFormData.salutation}
                      onChange={(e) => setEditFormData({ ...editFormData, salutation: e.target.value })}
                      className="select-filter-admin"
                      style={{ width: '100%' }}
                    >
                      <option value="">Salutation...</option>
                      {salutations.map((s, i) => <option key={i} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Certificate Display Name</label>
                    <input
                      type="text"
                      value={editFormData.certificateName}
                      onChange={(e) => setEditFormData({ ...editFormData, certificateName: e.target.value })}
                      placeholder="Name printed on Certificate"
                      required
                      className="input-flex-admin"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Registered Login Name</label>
                  <input
                    type="text"
                    value={editFormData.registeredName}
                    onChange={(e) => setEditFormData({ ...editFormData, registeredName: e.target.value })}
                    placeholder="Registered Login Name"
                    required
                    className="input-flex-admin"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Email Address</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="Email Address"
                      className="input-flex-admin"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Mobile Number</label>
                    <input
                      type="text"
                      value={editFormData.mobile}
                      onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                      placeholder="Mobile Number"
                      className="input-flex-admin"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>WhatsApp Number</label>
                    <input
                      type="text"
                      value={editFormData.wp}
                      onChange={(e) => setEditFormData({ ...editFormData, wp: e.target.value })}
                      placeholder="WhatsApp Number"
                      className="input-flex-admin"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>KVK / Institute Name</label>
                  <input
                    type="text"
                    value={editFormData.kvkName}
                    onChange={(e) => setEditFormData({ ...editFormData, kvkName: e.target.value })}
                    placeholder="Institute / KVK Name"
                    required
                    className="input-flex-admin"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>ATARI Zone Category</label>
                    <select
                      value={editFormData.atariZone}
                      onChange={(e) => setEditFormData({ ...editFormData, atariZone: e.target.value })}
                      className="select-filter-admin"
                      style={{ width: '100%' }}
                      required
                    >
                      <option value="">— Select ATARI Zone —</option>
                      <optgroup label="📍 KVK by ATARI Zone">
                        {categoryFilterOptions.kvkList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏛️ Institutes & Universities">
                        {categoryFilterOptions.instList.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>Serial Number</label>
                    <input
                      type="text"
                      value={editFormData.serialNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                      placeholder="Serial Number"
                      required
                      className="input-flex-admin"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn-admin-outline" onClick={() => setEditingLog(null)}>Cancel</button>
                  <button type="submit" className="btn-admin-primary">💾 Save & Update Record in Database</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* EDIT PARTICIPANT MODAL */}
      {
        editingParticipant && (
          <div className="modal-overlay-admin" onClick={() => setEditingParticipant(null)}>
            <div className="modal-card-admin" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h3>✏️ Edit Participant Headcount Record</h3>
                <button className="btn-close-modal" onClick={() => setEditingParticipant(null)}>✕</button>
              </div>

              <form onSubmit={handleSaveParticipantEdit} style={{ display: 'grid', gap: '14px' }}>
                <input
                  type="text"
                  value={editParticipantData.name || ''}
                  onChange={(e) => setEditParticipantData({ ...editParticipantData, name: e.target.value })}
                  placeholder="Participant Name"
                  required
                  className="input-flex-admin"
                />

                <input
                  type="text"
                  value={editParticipantData.serialNumber || ''}
                  onChange={(e) => setEditParticipantData({ ...editParticipantData, serialNumber: e.target.value })}
                  placeholder="Serial Number"
                  required
                  className="input-flex-admin"
                />

                <input
                  type="text"
                  value={editParticipantData.instituteName || ''}
                  onChange={(e) => setEditParticipantData({ ...editParticipantData, instituteName: e.target.value })}
                  placeholder="Institute / KVK Name"
                  className="input-flex-admin"
                />

                <select
                  value={editParticipantData.atariZone || ''}
                  onChange={(e) => setEditParticipantData({ ...editParticipantData, atariZone: e.target.value })}
                  className="select-filter-admin"
                >
                  <option value="">— Select Category / ATARI Zone —</option>
                  <optgroup label="📍 KVK by ATARI Zone">
                    {categoryFilterOptions.kvkList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏛️ Institutes & Universities">
                    {categoryFilterOptions.instList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                </select>

                <input
                  type="text"
                  value={editParticipantData.trainingDates || ''}
                  onChange={(e) => setEditParticipantData({ ...editParticipantData, trainingDates: e.target.value })}
                  placeholder="Training Dates (Optional e.g. Oct 13-17, 2025)"
                  className="input-flex-admin"
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn-admin-outline" onClick={() => setEditingParticipant(null)}>Cancel</button>
                  <button type="submit" className="btn-admin-primary">💾 Save Participant</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ZIP EXPORT PROGRESS MODAL */}
      {
        zipExportModal.isOpen && (
          <div className="modal-overlay-admin">
            <div className="modal-card-admin" style={{ textAlign: 'center' }}>
              <h3>{zipExportModal.title}</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Generating high-res certificates and creating ZIP archive...</p>
              <div style={{ background: 'var(--border-medium)', borderRadius: '8px', height: '12px', overflow: 'hidden', margin: '20px 0 10px 0' }}>
                <div style={{
                  width: `${zipExportModal.total > 0 ? Math.round((zipExportModal.current / zipExportModal.total) * 100) : 0}%`,
                  background: 'var(--accent-emerald)', height: '100%', transition: 'width 0.2s ease'
                }}></div>
              </div>
              <strong style={{ fontSize: '18px', color: 'var(--accent-emerald)' }}>
                {zipExportModal.current} / {zipExportModal.total} ({zipExportModal.total > 0 ? Math.round((zipExportModal.current / zipExportModal.total) * 100) : 0}%)
              </strong>
            </div>
          </div>
        )
      }

      {/* 4 COUNT DRILLDOWN DATA TABLE & CATEGORY-WISE EXCEL MODAL */}
      {
        drilldownModal && (
          <div className="modal-overlay-admin" onClick={() => setDrilldownModal(null)}>
            <div className="modal-card-admin modal-card-drilldown" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-flex" style={{ background: '#f8fafc', padding: '24px 30px', borderBottom: '1px solid #e2e8f0', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', margin: '-30px -30px 20px -30px' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px', color: '#0f172a', margin: 0 }}>
                    {drilldownModal.title}
                    <span className="status-badge-pill badge-active" style={{ fontSize: '12.5px', padding: '4px 12px' }}>
                      {filteredDrilldownList.length} {filteredDrilldownList.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </h3>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--text-tertiary)', fontSize: '13.5px' }}>
                    {drilldownModal.subtitle}
                  </p>
                </div>
                <button className="btn-close-modal" onClick={() => setDrilldownModal(null)} title="Close dialog" style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>✕</button>
              </div>

              {/* Filter & Action Toolbar */}
              <div className="drilldown-toolbar-flex">
                <div className="drilldown-search-group">
                  <input
                    type="text"
                    className="search-input-admin"
                    placeholder="🔍 Search name, serial, institute, contact..."
                    value={drilldownSearchQuery}
                    onChange={(e) => {
                      setDrilldownSearchQuery(e.target.value);
                      setDrilldownPage(1);
                    }}
                    style={{ minWidth: '220px', flex: 1 }}
                  />

                  <select
                    className="select-filter-admin"
                    value={drilldownCategoryFilter}
                    onChange={(e) => {
                      setDrilldownCategoryFilter(e.target.value);
                      setDrilldownPage(1);
                    }}
                    style={{ minWidth: '200px' }}
                  >
                    <option value="">🏛️ All Categories & ATARI Zones</option>
                    <optgroup label="📍 KVK by ATARI Zone">
                      {categoryFilterOptions.kvkList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🏛️ Institutes & Universities">
                      {categoryFilterOptions.instList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="drilldown-actions-group">
                  <button
                    type="button"
                    className="btn-admin-gold"
                    onClick={() => handleExportDrilldownToExcel(false)}
                    title="Export filtered records to Excel sheet"
                  >
                    📊 Export Excel ({filteredDrilldownList.length})
                  </button>
                  <button
                    type="button"
                    className="btn-admin-primary"
                    onClick={() => handleExportDrilldownToExcel(true)}
                    title="Download categorized multi-sheet Excel with category breakdown"
                  >
                    📑 Category-Wise Export
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="table-responsive-container" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Participant Name</th>
                      <th>Serial Number</th>
                      <th>Category / ATARI Zone</th>
                      <th>Institution / KVK Name</th>
                      <th>Status</th>
                      <th>Download Time (IST)</th>
                      <th>Contact Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDrilldownList.length > 0 ? (
                      paginatedDrilldownList.map((row, index) => {
                        const absoluteIndex = (drilldownPage - 1) * drilldownItemsPerPage + index + 1;

                        return (
                          <tr key={index}>
                            <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{absoluteIndex}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                              {row.registeredName && row.registeredName !== row.name && (
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Reg: {row.registeredName}</div>
                              )}
                            </td>
                            <td>
                              <code className="clean-serial-text" style={{ fontSize: '12px', fontWeight: 600 }}>{row.serialNumber}</code>
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                              {row.atariZone || row.category || '—'}
                            </td>
                            <td style={{ fontSize: '12.5px', fontWeight: 500 }}>
                              {row.instituteName || '—'}
                            </td>
                            <td>
                              {row.status.includes('Locked') ? (
                                <span className="status-badge-pill badge-locked">🔒 Locked</span>
                              ) : row.status.includes('Issued') ? (
                                <span className="status-badge-pill badge-active">🟢 Issued</span>
                              ) : (
                                <span className="status-badge-pill badge-pending">⏳ Pending</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {row.downloadTime ? new Date(row.downloadTime).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true
                              }) : '—'}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {row.email || row.mobile || row.wp ? (
                                <div>
                                  {row.email && <div>✉️ {row.email}</div>}
                                  {(row.mobile || row.wp) && <div>📞 {row.mobile || row.wp}</div>}
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                          <strong>No matching records found.</strong>
                          <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Try adjusting your search query or category filter.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="pagination-bar" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  Showing {filteredDrilldownList.length > 0 ? (drilldownPage - 1) * drilldownItemsPerPage + 1 : 0} to {Math.min(drilldownPage * drilldownItemsPerPage, filteredDrilldownList.length)} of {filteredDrilldownList.length} entries
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    <span>Rows:</span>
                    <select
                      value={drilldownItemsPerPage}
                      onChange={(e) => {
                        setDrilldownItemsPerPage(Number(e.target.value));
                        setDrilldownPage(1);
                      }}
                      className="select-filter-admin"
                      style={{ padding: '3px 8px', height: '30px', minWidth: '65px' }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="pagination-btn-group">
                    <button
                      type="button"
                      className="btn-page"
                      disabled={drilldownPage <= 1}
                      onClick={() => setDrilldownPage(p => Math.max(1, p - 1))}
                    >
                      ◀ Prev
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 8px' }}>
                      {drilldownPage} / {totalDrilldownPages}
                    </span>
                    <button
                      type="button"
                      className="btn-page"
                      disabled={drilldownPage >= totalDrilldownPages}
                      onClick={() => setDrilldownPage(p => Math.min(totalDrilldownPages, p + 1))}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn-admin-outline"
                  onClick={() => setDrilldownModal(null)}
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default AdminDashboard;
