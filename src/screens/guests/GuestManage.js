import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, FlatList, Modal, Share, ActivityIndicator,
    Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';
import { useToast } from '../../context/ToastContext';

const TABS_LIST = ['Guests', 'Gifts', 'Invite'];

function formatInviteDate(d) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatInviteTime(d) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function sanitizePhoneForWa(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (d.length === 10) return `91${d}`;
    if (d.length >= 12 && d.startsWith('91')) return d;
    if (d.length >= 10) return d;
    return '';
}
function chunkArr(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

const INVITE_THEMES = {
    rose: ['#FFF1F2', '#FFE4E6'],
    gold: ['#FFF8F0', '#FFF0E6'],
    navy: ['#EEF2FF', '#E0E7FF'],
    emerald: ['#ECFDF5', '#D1FAE5'],
    royal: ['#FAF5FF', '#F3E8FF'],
};
const COLOR_KEYS = ['rose', 'gold', 'navy', 'emerald', 'royal'];
const VARIATION_KEYS = ['classic', 'modern', 'festive', 'minimal'];

export default function GuestManage({ navigation }) {
    const insets = useSafeAreaInsets();
    const { theme, isDarkMode } = useTheme();
    const { t } = useLocale();
    const { showToast, showConfirm } = useToast();
    const { user, isAuthenticated, refreshSession } = useAuth();
    const userId = user?.id;

    /** Always refresh JWT before API calls — stale session.access_token causes "Invalid or expired token". */
    const resolveAccessToken = useCallback(async () => {
        const s = await refreshSession();
        return s?.access_token ?? null;
    }, [refreshSession]);
    const [activeTab, setActiveTab] = useState('Guests');
    const [guests, setGuests] = useState([]);
    const [gifts, setGifts] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddGuest, setShowAddGuest] = useState(false);
    const [showAddGift, setShowAddGift] = useState(false);
    const [showImportContacts, setShowImportContacts] = useState(false);
    const [showInviteDesigner, setShowInviteDesigner] = useState(false);
    const [guestForm, setGuestForm] = useState({ name: '', phone: '', relation: '', group: '', notes: '' });
    const [giftForm, setGiftForm] = useState({ guest_id: '', type: 'cash', amount: '', description: '' });
    const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
    const [guestDropdownSearch, setGuestDropdownSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [phoneContacts, setPhoneContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [contactSearch, setContactSearch] = useState('');
    const [inviteForm, setInviteForm] = useState({
        eventName: '',
        eventDate: '',
        eventTime: '',
        venueName: '',
        venueAddress: '',
        hostNames: '',
        message: '',
    });
    const [inviteDateValue, setInviteDateValue] = useState(() => new Date());
    const [inviteTimeValue, setInviteTimeValue] = useState(() => {
        const x = new Date();
        x.setHours(19, 0, 0, 0);
        return x;
    });
    const [showInviteDatePicker, setShowInviteDatePicker] = useState(false);
    const [showInviteTimePicker, setShowInviteTimePicker] = useState(false);
    const [inviteColorTheme, setInviteColorTheme] = useState('gold');
    const [inviteVariation, setInviteVariation] = useState('classic');
    const [inviteAiSamples, setInviteAiSamples] = useState([]);
    const [inviteAiFinal, setInviteAiFinal] = useState('');
    const [inviteAiLoadingSamples, setInviteAiLoadingSamples] = useState(false);
    const [inviteAiLoadingFinal, setInviteAiLoadingFinal] = useState(false);
    const [waModalVisible, setWaModalVisible] = useState(false);
    const [waChunkIdx, setWaChunkIdx] = useState(0);

    useEffect(() => {
        setInviteForm(p => ({
            ...p,
            eventDate: formatInviteDate(inviteDateValue),
            eventTime: formatInviteTime(inviteTimeValue),
        }));
    }, [inviteDateValue, inviteTimeValue]);

    const guestsWithPhoneList = useMemo(
        () => guests.filter(g => sanitizePhoneForWa(g.phone)),
        [guests]
    );
    const waChunks = useMemo(() => chunkArr(guestsWithPhoneList, 5), [guestsWithPhoneList]);

    const loadData = useCallback(async () => {
        if (!userId) {
            setDataLoading(false);
            return;
        }
        setDataLoading(true);
        try {
            const token = await resolveAccessToken();
            if (!token) {
                setDataLoading(false);
                return;
            }
            const [guestRes, giftRes] = await Promise.all([
                api.getGuests(token),
                api.getGifts(token),
            ]);
            if (Array.isArray(guestRes.data)) setGuests(guestRes.data);
            if (Array.isArray(giftRes.data)) setGifts(giftRes.data);
        } catch (e) {
            console.log('[GUEST LOAD ERROR]', e);
        } finally {
            setDataLoading(false);
        }
    }, [userId, resolveAccessToken]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const GUEST_LIMITS = { name: 100, phone: 20, relation: 50, group: 50, notes: 500 };

    const addGuest = async () => {
        const trimmedName = guestForm.name.trim();
        if (!trimmedName) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter guest name.' });
            return;
        }
        if (trimmedName.length > GUEST_LIMITS.name) {
            showToast({ variant: 'info', title: 'Too long', message: `Name must be under ${GUEST_LIMITS.name} characters.` });
            return;
        }
        const phoneDigits = guestForm.phone.replace(/\D/g, '');
        if (guestForm.phone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
            showToast({ variant: 'info', title: 'Invalid phone', message: 'Please enter a valid phone number.' });
            return;
        }
        if (!userId) {
            showToast({ variant: 'info', title: 'Login required', message: 'Please login to manage guests.' });
            navigation.navigate('Login');
            return;
        }
        setSaving(true);
        try {
            const token = await resolveAccessToken();
            if (!token) {
                showToast({ variant: 'info', title: 'Login required', message: 'Please sign in again to manage guests.' });
                navigation.navigate('Login');
                return;
            }
            const { data, error } = await api.addGuest(
                {
                    name: trimmedName.substring(0, GUEST_LIMITS.name),
                    phone: guestForm.phone ? guestForm.phone.substring(0, GUEST_LIMITS.phone) : null,
                    relation: guestForm.relation ? guestForm.relation.substring(0, GUEST_LIMITS.relation) : null,
                    group_name: guestForm.group ? guestForm.group.substring(0, GUEST_LIMITS.group) : null,
                    notes: guestForm.notes ? guestForm.notes.substring(0, GUEST_LIMITS.notes) : null,
                    invited: true,
                    rsvp: 'pending',
                },
                token
            );
            if (error) {
                showToast({ variant: 'error', title: 'Error', message: error.message || 'Failed to add guest.' });
            } else if (data) {
                setGuests(prev => [data, ...prev]);
            }
        } catch (e) {
            showToast({ variant: 'error', title: 'Error', message: 'Failed to add guest.' });
        } finally {
            setSaving(false);
            setGuestForm({ name: '', phone: '', relation: '', group: '', notes: '' });
            setShowAddGuest(false);
        }
    };

    const addGift = async () => {
        if (!giftForm.guest_id) {
            showToast({ variant: 'info', title: 'Required', message: 'Please select a guest.' });
            return;
        }
        if (!userId) {
            showToast({ variant: 'info', title: 'Login required', message: 'Please login to manage gifts.' });
            navigation.navigate('Login');
            return;
        }
        setSaving(true);
        try {
            const token = await resolveAccessToken();
            if (!token) {
                showToast({ variant: 'info', title: 'Login required', message: 'Please sign in again to manage gifts.' });
                navigation.navigate('Login');
                return;
            }
            const { data, error } = await api.addGift(
                {
                    guest_id: giftForm.guest_id,
                    type: giftForm.type || 'cash',
                    amount: giftForm.amount || '0',
                    description: giftForm.description || null,
                },
                token
            );
            if (error) {
                showToast({ variant: 'error', title: 'Error', message: error.message || 'Failed to save gift.' });
            } else if (data) {
                setGifts(prev => [data, ...prev]);
            }
        } catch (e) {
            showToast({ variant: 'error', title: 'Error', message: 'Failed to save gift.' });
        } finally {
            setSaving(false);
            setGiftForm({ guest_id: '', type: 'cash', amount: '', description: '' });
            setGuestDropdownSearch('');
            setShowAddGift(false);
        }
    };

    const removeGuest = (id) => {
        showConfirm({
            title: 'Remove guest',
            message: 'Are you sure? Associated gifts will also be removed.',
            cancelLabel: 'Cancel',
            confirmLabel: 'Remove',
            destructive: true,
            onConfirm: async () => {
                const token = await resolveAccessToken();
                if (!token) {
                    showToast({ variant: 'info', title: 'Login required', message: 'Please sign in again.' });
                    return;
                }
                const { error } = await api.deleteGuest(id, token);
                if (!error) {
                    setGuests(prev => prev.filter(g => g.id !== id));
                    setGifts(prev => prev.filter(g => g.guest_id !== id));
                } else {
                    showToast({ variant: 'error', title: 'Error', message: 'Failed to remove guest.' });
                }
            },
        });
    };

    const removeGift = (id) => {
        showConfirm({
            title: 'Remove gift',
            message: 'Are you sure?',
            cancelLabel: 'Cancel',
            confirmLabel: 'Remove',
            destructive: true,
            onConfirm: async () => {
                const token = await resolveAccessToken();
                if (!token) {
                    showToast({ variant: 'info', title: 'Login required', message: 'Please sign in again.' });
                    return;
                }
                const { error } = await api.deleteGift(id, token);
                if (!error) {
                    setGifts(prev => prev.filter(g => g.id !== id));
                } else {
                    showToast({ variant: 'error', title: 'Error', message: 'Failed to remove gift.' });
                }
            },
        });
    };

    const toggleRsvp = async (id) => {
        const guest = guests.find(g => g.id === id);
        if (!guest) return;
        const next = guest.rsvp === 'pending' ? 'confirmed' : guest.rsvp === 'confirmed' ? 'declined' : 'pending';
        setGuests(prev => prev.map(g => g.id === id ? { ...g, rsvp: next } : g));
        const token = await resolveAccessToken();
        if (token) {
            await api.updateGuest(id, { rsvp: next }, token);
        }
    };

    const loadPhoneContacts = async () => {
        setContactsLoading(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') {
                showToast({
                    variant: 'info',
                    title: 'Permission required',
                    message: 'Please allow access to contacts to import your guest list.',
                });
                setContactsLoading(false);
                return;
            }
            const contactOpts = {
                fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
            };
            if (Contacts.SortTypes?.FirstName) {
                contactOpts.sort = Contacts.SortTypes.FirstName;
            }
            const { data } = await Contacts.getContactsAsync(contactOpts);
            let idx = 0;
            const validContacts = (data || [])
                .filter(c => c.name)
                .map(c => ({
                    id: c.id || `contact_${idx++}`,
                    name: c.name,
                    phone: c.phoneNumbers?.[0]?.number || '',
                }));
            setPhoneContacts(validContacts);
            setSelectedContacts(new Set());
            setShowImportContacts(true);
        } catch (e) {
            console.log('[CONTACTS ERROR]', e?.message || e);
            showToast({
                variant: 'error',
                title: 'Error',
                message: `Could not load contacts: ${e?.message || 'Unknown error'}. Please try again.`,
            });
        } finally {
            setContactsLoading(false);
        }
    };

    const toggleContactSelection = (contactId) => {
        setSelectedContacts(prev => {
            const next = new Set(prev);
            if (next.has(contactId)) next.delete(contactId);
            else next.add(contactId);
            return next;
        });
    };

    const importSelectedContacts = async () => {
        if (!userId) {
            showToast({ variant: 'info', title: 'Login required', message: 'Please login to import contacts.' });
            navigation.navigate('Login');
            return;
        }
        const toImport = phoneContacts.filter(c => selectedContacts.has(c.id));
        if (toImport.length === 0) {
            showToast({ variant: 'info', title: 'No selection', message: 'Please select at least one contact to import.' });
            return;
        }
        const existingNames = new Set(guests.map(g => (g.name || '').toLowerCase().trim()));
        const existingPhones = new Set(
            guests.map(g => (g.phone || '').replace(/\D/g, '')).filter(p => p.length > 0)
        );
        const newContacts = toImport
            .filter(c => {
                const cleanPhone = (c.phone || '').replace(/\D/g, '');
                if (cleanPhone && existingPhones.has(cleanPhone)) return false;
                if (!cleanPhone && existingNames.has((c.name || '').toLowerCase().trim())) return false;
                return true;
            })
            .map(c => ({
                name: c.name,
                phone: c.phone || null,
                group_name: 'Contacts',
            }));
        const skipped = toImport.length - newContacts.length;
        if (newContacts.length === 0) {
            setShowImportContacts(false);
            setSelectedContacts(new Set());
            showToast({
                variant: 'info',
                title: 'No new contacts',
                message: `All ${toImport.length} selected contacts already exist in your guest list.`,
            });
            return;
        }
        setSaving(true);
        try {
            const token = await resolveAccessToken();
            if (!token) {
                showToast({ variant: 'info', title: 'Login required', message: 'Please sign in again to import contacts.' });
                setSaving(false);
                return;
            }
            const result = await api.bulkImportGuests({ guests: newContacts }, token);
            console.log('[IMPORT RESULT]', JSON.stringify(result));
            if (result.error) {
                showToast({
                    variant: 'error',
                    title: 'Import error',
                    message: result.error.message || 'Server returned an error. Please try again.',
                });
            } else {
                const imported = result.data?.imported || newContacts.length;
                if (result.data?.guests?.length) {
                    setGuests(prev => [...result.data.guests, ...prev]);
                } else {
                    await loadData();
                }
                setShowImportContacts(false);
                setSelectedContacts(new Set());
                showToast({
                    variant: 'success',
                    title: 'Imported',
                    message: `${imported} contact${imported !== 1 ? 's' : ''} added.${skipped > 0 ? ` ${skipped} skipped (already exist).` : ''}`,
                });
            }
        } catch (e) {
            console.log('[IMPORT ERROR]', e?.message || e);
            showToast({
                variant: 'error',
                title: 'Import error',
                message: `Something went wrong: ${e?.message || 'Unknown error'}. Please try again.`,
            });
        } finally {
            setSaving(false);
        }
    };

    const buildInvitationText = () => {
        if (inviteAiFinal && String(inviteAiFinal).trim()) {
            return `${String(inviteAiFinal).trim()}\n\n— Powered by Ekatraa`;
        }
        const f = inviteForm;
        const lines = [];
        lines.push('✨ You are cordially invited! ✨');
        lines.push('');
        if (f.eventName) lines.push(`🎉 ${f.eventName}`);
        if (f.hostNames) lines.push(`Hosted by: ${f.hostNames}`);
        lines.push('');
        if (f.eventDate) lines.push(`📅 Date: ${f.eventDate}`);
        if (f.eventTime) lines.push(`🕐 Time: ${f.eventTime}`);
        if (f.venueName) lines.push(`📍 Venue: ${f.venueName}`);
        if (f.venueAddress) lines.push(`   ${f.venueAddress}`);
        lines.push('');
        if (f.message) {
            lines.push(f.message);
            lines.push('');
        }
        lines.push('We look forward to your gracious presence!');
        lines.push('');
        lines.push('— Powered by Ekatraa');
        return lines.join('\n');
    };

    const openWhatsAppToNumber = async (digits, body) => {
        const url = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
        const can = await Linking.canOpenURL(url);
        if (can) await Linking.openURL(url);
        else showToast({ variant: 'error', title: 'WhatsApp', message: 'Could not open WhatsApp for this number.' });
    };

    const runGenerateSamples = async () => {
        if (!inviteForm.eventName.trim()) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter event name.' });
            return;
        }
        setInviteAiLoadingSamples(true);
        setInviteAiSamples([]);
        try {
            const { data, error } = await api.generateInvitation({
                mode: 'samples',
                eventName: inviteForm.eventName,
                eventDate: inviteForm.eventDate,
                eventTime: inviteForm.eventTime,
                venueName: inviteForm.venueName,
                venueAddress: inviteForm.venueAddress,
                hostNames: inviteForm.hostNames,
                message: inviteForm.message,
                colorTheme: inviteColorTheme,
                variation: inviteVariation,
            });
            if (error) {
                showToast({ variant: 'error', title: 'Error', message: error.message || 'Could not generate samples.' });
                return;
            }
            if (data?.samples?.length) setInviteAiSamples(data.samples.slice(0, 3));
            else showToast({ variant: 'info', title: 'Samples', message: 'No samples returned. Try again.' });
        } finally {
            setInviteAiLoadingSamples(false);
        }
    };

    const runGenerateFinal = async () => {
        if (!inviteForm.eventName.trim()) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter event name.' });
            return;
        }
        setInviteAiLoadingFinal(true);
        try {
            const { data, error } = await api.generateInvitation({
                mode: 'final',
                eventName: inviteForm.eventName,
                eventDate: inviteForm.eventDate,
                eventTime: inviteForm.eventTime,
                venueName: inviteForm.venueName,
                venueAddress: inviteForm.venueAddress,
                hostNames: inviteForm.hostNames,
                message: inviteForm.message,
                colorTheme: inviteColorTheme,
                variation: inviteVariation,
                samples: inviteAiSamples,
            });
            if (error) {
                showToast({ variant: 'error', title: 'Error', message: error.message || 'Could not generate final invite.' });
                return;
            }
            if (data?.final) setInviteAiFinal(String(data.final));
            else showToast({ variant: 'info', title: 'Final', message: 'No final text returned.' });
        } finally {
            setInviteAiLoadingFinal(false);
        }
    };

    const startWhatsappBatches = () => {
        if (!inviteForm.eventName.trim()) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter event name.' });
            return;
        }
        if (!guestsWithPhoneList.length) {
            showToast({ variant: 'info', title: 'WhatsApp', message: t('invite_wa_no_phone') });
            return;
        }
        setWaChunkIdx(0);
        setWaModalVisible(true);
    };

    const shareInvitation = async () => {
        if (!inviteForm.eventName.trim()) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter event name.' });
            return;
        }
        const text = buildInvitationText();
        try {
            await Share.share({ message: text, title: inviteForm.eventName });
        } catch (e) { }
    };

    const shareToSpecificGuest = async (guest) => {
        if (!inviteForm.eventName.trim()) {
            showToast({
                variant: 'info',
                title: 'Fill invitation',
                message: 'Please fill the invitation details first, then share.',
            });
            return;
        }
        const personalText = `Dear ${guest.name},\n\n${buildInvitationText()}`;
        try {
            await Share.share({ message: personalText, title: inviteForm.eventName });
        } catch (e) { }
    };

    const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredGifts = gifts.filter(g => (g.guest_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const totalGiftAmount = gifts.filter(g => g.type === 'cash').reduce((s, g) => s + (g.amount || 0), 0);
    const filteredPhoneContacts = phoneContacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        (c.phone || '').includes(contactSearch)
    );
    const dropdownGuests = guests.filter(g =>
        g.name.toLowerCase().includes(guestDropdownSearch.toLowerCase())
    );
    const selectedGiftGuest = guests.find(g => g.id === giftForm.guest_id);

    const rsvpColor = (status) => {
        if (status === 'confirmed') return '#22C55E';
        if (status === 'declined') return '#EF4444';
        return '#F59E0B';
    };

    const renderGuest = ({ item }) => (
        <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.listName, { color: theme.text }]}>{item.name}</Text>
                <View style={styles.listMeta}>
                    {item.relation ? <Text style={[styles.listTag, { color: theme.textLight }]}>{item.relation}</Text> : null}
                    {(item.group_name || item.group) ? <Text style={[styles.listTag, { color: theme.textLight }]}>• {item.group_name || item.group}</Text> : null}
                    {item.phone ? <Text style={[styles.listTag, { color: theme.textLight }]}>• {item.phone}</Text> : null}
                </View>
            </View>
            <TouchableOpacity
                style={[styles.rsvpBadge, { backgroundColor: rsvpColor(item.rsvp) + '18' }]}
                onPress={() => toggleRsvp(item.id)}
            >
                <Text style={[styles.rsvpText, { color: rsvpColor(item.rsvp) }]}>{item.rsvp}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeGuest(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    const renderGift = ({ item }) => (
        <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.listName, { color: theme.text }]}>{item.guest_name}</Text>
                <View style={styles.listMeta}>
                    <Text style={[styles.listTag, { color: theme.textLight }]}>
                        {item.type === 'cash' ? `₹${(item.amount || 0).toLocaleString()}` : item.description || 'Gift item'}
                    </Text>
                </View>
            </View>
            <View style={[styles.giftTypeBadge, { backgroundColor: item.type === 'cash' ? '#22C55E18' : colors.primary + '15' }]}>
                <Ionicons name={item.type === 'cash' ? 'cash-outline' : 'gift-outline'} size={16} color={item.type === 'cash' ? '#22C55E' : colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: item.type === 'cash' ? '#22C55E' : colors.primary, marginLeft: 4 }}>
                    {item.type === 'cash' ? 'Cash' : 'Gift'}
                </Text>
            </View>
            <TouchableOpacity onPress={() => removeGift(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    const inviteCardGradient = isDarkMode
        ? ['#181B25', '#1A1D27']
        : (INVITE_THEMES[inviteColorTheme] || INVITE_THEMES.gold);
    const previewGrad = INVITE_THEMES[inviteColorTheme] || INVITE_THEMES.gold;

    const renderInviteTab = () => (
        <ScrollView contentContainerStyle={styles.inviteScroll} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={inviteCardGradient} style={styles.inviteCard}>
                <View style={styles.inviteHeaderRow}>
                    <View style={[styles.inviteLogoWrap, { backgroundColor: colors.primary }]}>
                        <Text style={styles.inviteLogoText}>eK</Text>
                    </View>
                    <Text style={[styles.inviteCardTitle, { color: theme.text }]}>{t('invite_title')}</Text>
                </View>
                <Text style={[styles.inviteDesc, { color: theme.textLight }]}>
                    {t('invite_desc')}
                </Text>

                <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder={t('invite_event_name_ph')}
                    placeholderTextColor={theme.textLight}
                    value={inviteForm.eventName}
                    onChangeText={txt => setInviteForm(p => ({ ...p, eventName: txt }))}
                />
                <View style={styles.inviteRow}>
                    <TouchableOpacity
                        style={[styles.input, styles.halfInput, { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        onPress={() => setShowInviteDatePicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={18} color={theme.textLight} />
                        <Text style={{ color: theme.text, flex: 1, fontSize: 15 }}>{formatInviteDate(inviteDateValue)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.input, styles.halfInput, { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        onPress={() => setShowInviteTimePicker(true)}
                    >
                        <Ionicons name="time-outline" size={18} color={theme.textLight} />
                        <Text style={{ color: theme.text, flex: 1, fontSize: 15 }}>{formatInviteTime(inviteTimeValue)}</Text>
                    </TouchableOpacity>
                </View>
                {showInviteDatePicker ? (
                    <DateTimePicker
                        value={inviteDateValue}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            setShowInviteDatePicker(false);
                            if (d) setInviteDateValue(d);
                        }}
                    />
                ) : null}
                {showInviteTimePicker ? (
                    <DateTimePicker
                        value={inviteTimeValue}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            setShowInviteTimePicker(false);
                            if (d) setInviteTimeValue(d);
                        }}
                    />
                ) : null}

                <Text style={[styles.chipsLabel, { color: theme.textLight }]}>{t('invite_color_label')}</Text>
                <View style={styles.chipRow}>
                    {COLOR_KEYS.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[
                                styles.chip,
                                { borderColor: theme.border, backgroundColor: theme.inputBackground },
                                inviteColorTheme === c && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                            ]}
                            onPress={() => setInviteColorTheme(c)}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: inviteColorTheme === c ? colors.primary : theme.text }}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={[styles.chipsLabel, { color: theme.textLight }]}>{t('invite_variation_label')}</Text>
                <View style={styles.chipRow}>
                    {VARIATION_KEYS.map(v => (
                        <TouchableOpacity
                            key={v}
                            style={[
                                styles.chip,
                                { borderColor: theme.border, backgroundColor: theme.inputBackground },
                                inviteVariation === v && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                            ]}
                            onPress={() => setInviteVariation(v)}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: inviteVariation === v ? colors.primary : theme.text }}>{v}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder={t('invite_venue_name')}
                    placeholderTextColor={theme.textLight}
                    value={inviteForm.venueName}
                    onChangeText={txt => setInviteForm(p => ({ ...p, venueName: txt }))}
                />
                <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder={t('invite_venue_address')}
                    placeholderTextColor={theme.textLight}
                    value={inviteForm.venueAddress}
                    onChangeText={txt => setInviteForm(p => ({ ...p, venueAddress: txt }))}
                />
                <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder={t('invite_hosts_ph')}
                    placeholderTextColor={theme.textLight}
                    value={inviteForm.hostNames}
                    onChangeText={txt => setInviteForm(p => ({ ...p, hostNames: txt }))}
                />
                <TextInput
                    style={[styles.input, styles.multilineInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder={t('invite_message_ph')}
                    placeholderTextColor={theme.textLight}
                    value={inviteForm.message}
                    onChangeText={txt => setInviteForm(p => ({ ...p, message: txt }))}
                    multiline
                    numberOfLines={3}
                />

                <TouchableOpacity
                    style={[styles.aiBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '50' }]}
                    onPress={runGenerateSamples}
                    disabled={inviteAiLoadingSamples}
                >
                    {inviteAiLoadingSamples ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="sparkles" size={18} color={colors.primary} />}
                    <Text style={[styles.aiBtnText, { color: colors.primary }]}>{t('invite_gen_samples')}</Text>
                </TouchableOpacity>
                {inviteAiSamples.length > 0 ? (
                    <View style={styles.samplesBox}>
                        <Text style={[styles.samplesTitle, { color: theme.text }]}>{t('invite_samples_heading')}</Text>
                        {inviteAiSamples.map((s, idx) => (
                            <View key={idx} style={[styles.sampleCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                                <Text style={[styles.sampleText, { color: theme.text }]} numberOfLines={8}>{s}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[styles.aiBtn, { backgroundColor: '#8B5CF620', borderColor: '#8B5CF650' }]}
                    onPress={runGenerateFinal}
                    disabled={inviteAiLoadingFinal}
                >
                    {inviteAiLoadingFinal ? <ActivityIndicator color="#8B5CF6" /> : <Ionicons name="color-wand-outline" size={18} color="#8B5CF6" />}
                    <Text style={[styles.aiBtnText, { color: '#8B5CF6' }]}>{t('invite_gen_final')}</Text>
                </TouchableOpacity>
                {inviteAiFinal ? (
                    <View style={[styles.finalBox, { borderColor: theme.border }]}>
                        <Text style={[styles.samplesTitle, { color: theme.text }]}>{t('invite_final_heading')}</Text>
                        <Text style={[styles.finalText, { color: theme.text }]}>{inviteAiFinal}</Text>
                    </View>
                ) : null}
            </LinearGradient>

            {inviteForm.eventName.trim() ? (
                <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.previewLabel, { color: theme.textLight }]}>{t('invite_preview')}</Text>
                    <LinearGradient colors={previewGrad} style={styles.previewInner}>
                        {inviteAiFinal ? (
                            <>
                                <Text style={styles.previewStar}>✨</Text>
                                <Text style={[styles.previewAiBlock, { color: '#4A2800' }]}>{inviteAiFinal}</Text>
                                <View style={styles.previewBrand}>
                                    <View style={styles.previewBrandDot} />
                                    <Text style={styles.previewBrandText}>Powered by Ekatraa</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.previewStar}>✨</Text>
                                <Text style={styles.previewTitle}>{t('invite_preview_title')}</Text>
                                <Text style={styles.previewEvent}>{inviteForm.eventName}</Text>
                                {inviteForm.hostNames ? <Text style={styles.previewHost}>Hosted by: {inviteForm.hostNames}</Text> : null}
                                <View style={styles.previewDivider} />
                                {inviteForm.eventDate ? (
                                    <View style={styles.previewDetailRow}>
                                        <Ionicons name="calendar-outline" size={14} color="#8B6914" />
                                        <Text style={styles.previewDetail}>{inviteForm.eventDate}{inviteForm.eventTime ? ` at ${inviteForm.eventTime}` : ''}</Text>
                                    </View>
                                ) : null}
                                {inviteForm.venueName ? (
                                    <View style={styles.previewDetailRow}>
                                        <Ionicons name="location-outline" size={14} color="#8B6914" />
                                        <Text style={styles.previewDetail}>{inviteForm.venueName}{inviteForm.venueAddress ? `\n${inviteForm.venueAddress}` : ''}</Text>
                                    </View>
                                ) : null}
                                {inviteForm.message ? <Text style={styles.previewMessage}>{inviteForm.message}</Text> : null}
                                <Text style={styles.previewFooter}>{t('invite_preview_footer')}</Text>
                                <View style={styles.previewBrand}>
                                    <View style={styles.previewBrandDot} />
                                    <Text style={styles.previewBrandText}>Powered by Ekatraa</Text>
                                </View>
                            </>
                        )}
                    </LinearGradient>
                </View>
            ) : null}

            <View style={styles.shareActions}>
                <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                    onPress={shareInvitation}
                >
                    <Ionicons name="share-outline" size={20} color="#FFF" />
                    <Text style={styles.shareBtnText}>{t('invite_share')}</Text>
                </TouchableOpacity>
                {guests.length > 0 && inviteForm.eventName.trim() ? (
                    <TouchableOpacity
                        style={[styles.shareBtnOutline, { borderColor: colors.primary }]}
                        onPress={() => {
                            showConfirm({
                                title: t('invite_send_all'),
                                message: `Share personalized invitations with ${guests.length} guest${guests.length !== 1 ? 's' : ''}?`,
                                cancelLabel: 'Cancel',
                                confirmLabel: 'Share',
                                onConfirm: () => shareInvitation(),
                            });
                        }}
                    >
                        <Ionicons name="people-outline" size={20} color={colors.primary} />
                        <Text style={[styles.shareBtnOutlineText, { color: colors.primary }]}>{t('invite_send_all')} ({guests.length})</Text>
                    </TouchableOpacity>
                ) : null}
                {guestsWithPhoneList.length > 0 && inviteForm.eventName.trim() ? (
                    <TouchableOpacity
                        style={[styles.shareBtnOutline, { borderColor: '#25D366' }]}
                        onPress={startWhatsappBatches}
                    >
                        <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                        <Text style={[styles.shareBtnOutlineText, { color: '#25D366' }]}>
                            {t('invite_whatsapp_batches')} ({guestsWithPhoneList.length})
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {guests.length > 0 && inviteForm.eventName.trim() ? (
                <View style={[styles.guestShareList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.guestShareTitle, { color: theme.text }]}>Send to Individual Guest</Text>
                    {guests.map(g => (
                        <TouchableOpacity
                            key={g.id}
                            style={[styles.guestShareRow, { borderBottomColor: theme.border }]}
                            onPress={() => shareToSpecificGuest(g)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.guestShareName, { color: theme.text }]}>{g.name}</Text>
                                {g.phone ? <Text style={[styles.guestSharePhone, { color: theme.textLight }]}>{g.phone}</Text> : null}
                            </View>
                            <Ionicons name="send-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

            <View style={{ height: 40 }} />
        </ScrollView>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('guest_manager_title')}</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: colors.primary + '12' }]}>
                    <Text style={[styles.statNum, { color: colors.primary }]}>{guests.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textLight }]}>{t('guest_stat_guests')}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#22C55E18' }]}>
                    <Text style={[styles.statNum, { color: '#22C55E' }]}>{guests.filter(g => g.rsvp === 'confirmed').length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textLight }]}>{t('guest_stat_confirmed')}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#F59E0B18' }]}>
                    <Text style={[styles.statNum, { color: '#F59E0B' }]}>{gifts.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textLight }]}>{t('guest_stat_gifts')}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#8B5CF618' }]}>
                    <Text style={[styles.statNum, { color: '#8B5CF6' }]}>₹{totalGiftAmount.toLocaleString()}</Text>
                    <Text style={[styles.statLabel, { color: theme.textLight }]}>{t('guest_stat_cash')}</Text>
                </View>
            </View>

            <View style={styles.tabRow}>
                {TABS_LIST.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabBtn, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
                    >
                        <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : theme.textLight }]}>
                            {tab === 'Guests' ? t('guest_tab_guests') : tab === 'Gifts' ? t('guest_tab_gifts') : t('guest_tab_invite')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab !== 'Invite' && (
                <View style={[styles.searchRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                    <Ionicons name="search-outline" size={18} color={theme.textLight} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder={activeTab === 'Guests' ? t('guest_search_guests') : t('guest_search_gifts')}
                        placeholderTextColor={theme.textLight}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            )}

            {dataLoading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.textLight }]}>{t('invite_loading_guests')}</Text>
                </View>
            ) : !isAuthenticated ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="lock-closed-outline" size={48} color={theme.textLight} />
                    <Text style={[styles.emptyText, { color: theme.textLight }]}>{t('invite_login_required')}</Text>
                    <Text style={[styles.emptyHint, { color: theme.textLight }]}>{t('invite_login_hint')}</Text>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 16, paddingHorizontal: 32 }]}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.saveBtnText}>Login</Text>
                    </TouchableOpacity>
                </View>
            ) : activeTab === 'Guests' ? (
                <View style={{ flex: 1 }}>
                    <View style={styles.importRow}>
                        <TouchableOpacity
                            style={[styles.importBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
                            onPress={loadPhoneContacts}
                            disabled={contactsLoading}
                        >
                            {contactsLoading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
                            )}
                            <Text style={[styles.importBtnText, { color: colors.primary }]}>Import Contacts</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.importBtn, { backgroundColor: '#25D366' + '12', borderColor: '#25D366' + '30' }]}
                            onPress={() => {
                                showConfirm({
                                    title: 'Import from WhatsApp',
                                    message:
                                        'To import WhatsApp group members:\n\n1. Open the WhatsApp group\n2. Tap group name → Members\n3. Long-press each contact → Add to Phone Contacts\n4. Then use "Import Contacts" here\n\nAlternatively, you can manually add guests using the + button.',
                                    cancelLabel: 'OK',
                                    confirmLabel: 'Import Contacts',
                                    onConfirm: () => loadPhoneContacts(),
                                });
                            }}
                        >
                            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                            <Text style={[styles.importBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={filteredGuests}
                        renderItem={renderGuest}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Ionicons name="people-outline" size={48} color={theme.textLight} />
                                <Text style={[styles.emptyText, { color: theme.textLight }]}>No guests added yet</Text>
                                <Text style={[styles.emptyHint, { color: theme.textLight }]}>Tap + to add or import contacts</Text>
                            </View>
                        }
                    />
                </View>
            ) : activeTab === 'Gifts' ? (
                <FlatList
                    data={filteredGifts}
                    renderItem={renderGift}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="gift-outline" size={48} color={theme.textLight} />
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No gifts recorded yet</Text>
                            <Text style={[styles.emptyHint, { color: theme.textLight }]}>Tap + to record a gift</Text>
                        </View>
                    }
                />
            ) : (
                renderInviteTab()
            )}

            {/* Add Guest Modal */}
            <Modal visible={showAddGuest} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAddGuest(false)} activeOpacity={1}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Add Guest</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Name *" placeholderTextColor={theme.textLight} value={guestForm.name} onChangeText={t => setGuestForm(p => ({ ...p, name: t }))} maxLength={GUEST_LIMITS.name} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Phone" placeholderTextColor={theme.textLight} value={guestForm.phone} onChangeText={t => setGuestForm(p => ({ ...p, phone: t }))} keyboardType="phone-pad" maxLength={GUEST_LIMITS.phone} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Relation (e.g. Uncle, Friend)" placeholderTextColor={theme.textLight} value={guestForm.relation} onChangeText={t => setGuestForm(p => ({ ...p, relation: t }))} maxLength={GUEST_LIMITS.relation} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Group (e.g. Family, Office)" placeholderTextColor={theme.textLight} value={guestForm.group} onChangeText={t => setGuestForm(p => ({ ...p, group: t }))} maxLength={GUEST_LIMITS.group} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Notes" placeholderTextColor={theme.textLight} value={guestForm.notes} onChangeText={t => setGuestForm(p => ({ ...p, notes: t }))} maxLength={GUEST_LIMITS.notes} />
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={addGuest}>
                            <Text style={styles.saveBtnText}>Add Guest</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Add Gift Modal — with guest dropdown */}
            <Modal visible={showAddGift} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => { setShowAddGift(false); setGuestDropdownOpen(false); }} activeOpacity={1}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Record Gift</Text>

                        {guests.length === 0 ? (
                            <View style={[styles.noGuestsBox, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40' }]}>
                                <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
                                <Text style={{ color: '#92710C', fontSize: 13, flex: 1, marginLeft: 8 }}>
                                    Add guests first before recording gifts.
                                </Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={[styles.dropdownLabel, { color: theme.textLight }]}>Select Guest *</Text>
                                <TouchableOpacity
                                    style={[styles.dropdownTrigger, { backgroundColor: theme.inputBackground, borderColor: guestDropdownOpen ? colors.primary : theme.border }]}
                                    onPress={() => setGuestDropdownOpen(!guestDropdownOpen)}
                                >
                                    <Text style={[styles.dropdownTriggerText, { color: selectedGiftGuest ? theme.text : theme.textLight }]}>
                                        {selectedGiftGuest ? selectedGiftGuest.name : 'Choose a guest...'}
                                    </Text>
                                    <Ionicons name={guestDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textLight} />
                                </TouchableOpacity>

                                {guestDropdownOpen && (
                                    <View style={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <View style={[styles.dropdownSearchRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                                            <Ionicons name="search-outline" size={14} color={theme.textLight} />
                                            <TextInput
                                                style={[styles.dropdownSearchInput, { color: theme.text }]}
                                                placeholder="Search guests..."
                                                placeholderTextColor={theme.textLight}
                                                value={guestDropdownSearch}
                                                onChangeText={setGuestDropdownSearch}
                                                autoFocus
                                            />
                                        </View>
                                        <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                                            {dropdownGuests.length === 0 ? (
                                                <Text style={[styles.dropdownEmpty, { color: theme.textLight }]}>No guests found</Text>
                                            ) : (
                                                dropdownGuests.map(g => (
                                                    <TouchableOpacity
                                                        key={g.id}
                                                        style={[
                                                            styles.dropdownItem,
                                                            { borderBottomColor: theme.border },
                                                            giftForm.guest_id === g.id && { backgroundColor: colors.primary + '10' },
                                                        ]}
                                                        onPress={() => {
                                                            setGiftForm(p => ({ ...p, guest_id: g.id }));
                                                            setGuestDropdownOpen(false);
                                                            setGuestDropdownSearch('');
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownItemName, { color: theme.text }]}>{g.name}</Text>
                                                        {g.phone ? <Text style={[styles.dropdownItemPhone, { color: theme.textLight }]}>{g.phone}</Text> : null}
                                                        {giftForm.guest_id === g.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </ScrollView>
                                    </View>
                                )}

                                <View style={styles.typeRow}>
                                    {['cash', 'gift'].map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.typeBtn, { borderColor: theme.border }, giftForm.type === type && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                                            onPress={() => setGiftForm(p => ({ ...p, type }))}
                                        >
                                            <Ionicons name={type === 'cash' ? 'cash-outline' : 'gift-outline'} size={18} color={giftForm.type === type ? colors.primary : theme.textLight} />
                                            <Text style={[styles.typeText, { color: giftForm.type === type ? colors.primary : theme.text }]}>{type === 'cash' ? 'Cash' : 'Gift Item'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {giftForm.type === 'cash' ? (
                                    <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Amount (₹)" placeholderTextColor={theme.textLight} value={giftForm.amount} onChangeText={t => setGiftForm(p => ({ ...p, amount: t }))} keyboardType="numeric" />
                                ) : (
                                    <TextInput style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]} placeholder="Gift description" placeholderTextColor={theme.textLight} value={giftForm.description} onChangeText={t => setGiftForm(p => ({ ...p, description: t }))} />
                                )}
                                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={addGift}>
                                    <Text style={styles.saveBtnText}>Save Gift</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Import Contacts Modal */}
            <Modal visible={showImportContacts} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowImportContacts(false)} activeOpacity={1}>
                    <View style={[styles.modalContent, styles.modalTall, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <View style={styles.importHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>Import Contacts</Text>
                            <Text style={[styles.importCount, { color: theme.textLight }]}>{selectedContacts.size} selected</Text>
                        </View>
                        <View style={[styles.dropdownSearchRow, { backgroundColor: theme.inputBackground, borderColor: theme.border, marginBottom: 10 }]}>
                            <Ionicons name="search-outline" size={16} color={theme.textLight} />
                            <TextInput
                                style={[styles.dropdownSearchInput, { color: theme.text }]}
                                placeholder="Search contacts..."
                                placeholderTextColor={theme.textLight}
                                value={contactSearch}
                                onChangeText={setContactSearch}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.selectAllBtn}
                            onPress={() => {
                                if (selectedContacts.size === filteredPhoneContacts.length) {
                                    setSelectedContacts(new Set());
                                } else {
                                    setSelectedContacts(new Set(filteredPhoneContacts.map(c => c.id)));
                                }
                            }}
                        >
                            <Ionicons
                                name={selectedContacts.size === filteredPhoneContacts.length && filteredPhoneContacts.length > 0 ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={colors.primary}
                            />
                            <Text style={[styles.selectAllText, { color: colors.primary }]}>
                                {selectedContacts.size === filteredPhoneContacts.length && filteredPhoneContacts.length > 0 ? 'Deselect All' : 'Select All'}
                            </Text>
                        </TouchableOpacity>
                        <FlatList
                            data={filteredPhoneContacts}
                            keyExtractor={item => item.id}
                            style={{ flex: 1 }}
                            renderItem={({ item }) => {
                                const sel = selectedContacts.has(item.id);
                                return (
                                    <TouchableOpacity
                                        style={[styles.contactItem, { borderBottomColor: theme.border }, sel && { backgroundColor: colors.primary + '08' }]}
                                        onPress={() => toggleContactSelection(item.id)}
                                    >
                                        <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? colors.primary : theme.textLight} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
                                            {item.phone ? <Text style={[styles.contactPhone, { color: theme.textLight }]}>{item.phone}</Text> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <Text style={[styles.dropdownEmpty, { color: theme.textLight }]}>No contacts found</Text>
                            }
                        />
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 10 }, selectedContacts.size === 0 && { opacity: 0.5 }]}
                            onPress={importSelectedContacts}
                            disabled={selectedContacts.size === 0}
                        >
                            <Text style={styles.saveBtnText}>Import {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={waModalVisible} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setWaModalVisible(false)} activeOpacity={1}>
                    <View style={[styles.modalContent, styles.modalTall, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 8 }]}>
                            {t('invite_wa_batch_title')} ({waChunkIdx + 1}/{Math.max(waChunks.length, 1)})
                        </Text>
                        <Text style={[styles.waHint, { color: theme.textLight }]}>
                            {t('invite_wa_open')} — max 5 guests per batch
                        </Text>
                        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                            {(waChunks[waChunkIdx] || []).map(g => {
                                const digits = sanitizePhoneForWa(g.phone);
                                return (
                                    <TouchableOpacity
                                        key={g.id}
                                        style={[styles.waRow, { borderBottomColor: theme.border }]}
                                        onPress={() => {
                                            const msg = `Dear ${g.name},\n\n${buildInvitationText()}`;
                                            if (digits) openWhatsAppToNumber(digits, msg);
                                            else showToast({
                                                variant: 'info',
                                                title: 'No number',
                                                message: 'This guest has no valid phone number.',
                                            });
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.waName, { color: theme.text }]}>{g.name}</Text>
                                            {g.phone ? <Text style={[styles.waPhone, { color: theme.textLight }]}>{g.phone}</Text> : null}
                                        </View>
                                        <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <View style={styles.waFooter}>
                            <TouchableOpacity style={[styles.waSecondary, { borderColor: theme.border }]} onPress={() => setWaModalVisible(false)}>
                                <Text style={{ color: theme.text, fontWeight: '600' }}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: '#25D366', flex: 1, marginTop: 0 }]}
                                onPress={() => {
                                    if (waChunkIdx < waChunks.length - 1) setWaChunkIdx(waChunkIdx + 1);
                                    else setWaModalVisible(false);
                                }}
                            >
                                <Text style={styles.saveBtnText}>
                                    {waChunkIdx < waChunks.length - 1 ? t('invite_wa_next_batch') : t('invite_wa_done')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            <BottomTabBar navigation={navigation} activeRoute="Home" />

            {activeTab !== 'Invite' && (
                <TouchableOpacity
                    style={[
                        styles.fab,
                        {
                            bottom:
                                50 +
                                Math.max(insets.bottom, 6) +
                                12,
                            zIndex: 100,
                            ...(Platform.OS === 'android' ? { elevation: 16 } : {}),
                        },
                    ]}
                    onPress={() => activeTab === 'Guests' ? setShowAddGuest(true) : setShowAddGift(true)}
                >
                    <LinearGradient colors={[colors.primary, '#FFA040']} style={styles.fabGradient}>
                        <Ionicons name="add" size={28} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    statBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
    statNum: { fontSize: 16, fontWeight: '800' },
    statLabel: { fontSize: 10, marginTop: 2 },
    tabRow: { flexDirection: 'row', paddingHorizontal: 16 },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 15, fontWeight: '600' },
    searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
    searchInput: { flex: 1, height: 40, fontSize: 14 },
    importRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 6 },
    importBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    importBtnText: { fontSize: 12, fontWeight: '600' },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    listCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 10 },
    listName: { fontSize: 15, fontWeight: '600' },
    listMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    listTag: { fontSize: 12 },
    rsvpBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    rsvpText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    giftTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    deleteBtn: { padding: 6 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { fontSize: 16, fontWeight: '600' },
    emptyHint: { fontSize: 13 },
    fab: { position: 'absolute', right: 20, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
    fabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, maxHeight: '80%' },
    modalTall: { maxHeight: '90%', flex: 1, marginTop: '10%' },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 15 },
    multilineInput: { minHeight: 72, textAlignVertical: 'top' },
    halfInput: { flex: 1 },
    typeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12 },
    typeText: { fontSize: 14, fontWeight: '600' },
    saveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    noGuestsBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
    dropdownLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
    dropdownTriggerText: { fontSize: 15 },
    dropdownList: { borderWidth: 1, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
    dropdownSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, gap: 6 },
    dropdownSearchInput: { flex: 1, height: 36, fontSize: 13 },
    dropdownScroll: { maxHeight: 180 },
    dropdownEmpty: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
    dropdownItemName: { flex: 1, fontSize: 14, fontWeight: '500' },
    dropdownItemPhone: { fontSize: 12, marginRight: 8 },
    importHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    importCount: { fontSize: 13 },
    selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    selectAllText: { fontSize: 13, fontWeight: '600' },
    contactItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1 },
    contactName: { fontSize: 14, fontWeight: '500' },
    contactPhone: { fontSize: 12, marginTop: 2 },
    inviteScroll: { padding: 16, paddingBottom: 40 },
    inviteCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
    inviteHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    inviteLogoWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    inviteLogoText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
    inviteCardTitle: { fontSize: 18, fontWeight: '800' },
    inviteDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
    inviteRow: { flexDirection: 'row', gap: 10 },
    previewCard: { borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 16, overflow: 'hidden' },
    previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textAlign: 'center', paddingVertical: 6 },
    previewInner: { borderRadius: 14, padding: 24, alignItems: 'center' },
    previewStar: { fontSize: 24, marginBottom: 6 },
    previewTitle: { fontSize: 14, color: '#8B6914', fontWeight: '600', marginBottom: 4 },
    previewEvent: { fontSize: 22, fontWeight: '900', color: '#4A2800', textAlign: 'center', marginBottom: 4 },
    previewHost: { fontSize: 13, color: '#6B4E1D', fontStyle: 'italic', marginBottom: 6 },
    previewDivider: { width: 60, height: 1.5, backgroundColor: '#C8A85C', marginVertical: 12 },
    previewDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    previewDetail: { fontSize: 13, color: '#5C4318', lineHeight: 18 },
    previewMessage: { fontSize: 13, color: '#5C4318', fontStyle: 'italic', textAlign: 'center', marginTop: 10, lineHeight: 20 },
    previewFooter: { fontSize: 12, color: '#8B6914', marginTop: 14, fontWeight: '500' },
    previewBrand: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
    previewBrandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF7A00' },
    previewBrandText: { fontSize: 10, color: '#999', fontWeight: '600' },
    shareActions: { gap: 10, marginBottom: 16 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
    shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    shareBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
    shareBtnOutlineText: { fontSize: 14, fontWeight: '600' },
    guestShareList: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
    guestShareTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
    guestShareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    guestShareName: { fontSize: 14, fontWeight: '500' },
    guestSharePhone: { fontSize: 12, marginTop: 2 },
    chipsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
    aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
    aiBtnText: { fontSize: 14, fontWeight: '700' },
    samplesBox: { marginBottom: 12 },
    samplesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    sampleCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
    sampleText: { fontSize: 13, lineHeight: 20 },
    finalBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
    finalText: { fontSize: 13, lineHeight: 22 },
    previewAiBlock: { fontSize: 13, lineHeight: 22, textAlign: 'center', marginVertical: 8 },
    waHint: { fontSize: 12, marginBottom: 12 },
    waRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    waName: { fontSize: 15, fontWeight: '600' },
    waPhone: { fontSize: 12, marginTop: 2 },
    waFooter: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
    waSecondary: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1 },
});
