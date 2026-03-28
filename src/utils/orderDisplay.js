/**
 * Maps order rows to occasion label (event type name) vs who applied (role).
 * New rows: event_name = occasion, event_role = Groom|Bride|Host|Other.
 * Legacy: event_name sometimes stored only the role — treat as applicant only.
 */

const ROLE_LABELS = /^(Groom|Bride|Host|Other)$/i;

export function getOccasionAndApplicant(order) {
    if (!order || typeof order !== 'object') {
        return { occasionLabel: null, applicantLabel: null };
    }
    const er = typeof order.event_role === 'string' ? order.event_role.trim() : '';
    const en = typeof order.event_name === 'string' ? order.event_name.trim() : '';

    if (er) {
        return { occasionLabel: en || null, applicantLabel: er };
    }
    if (en && ROLE_LABELS.test(en)) {
        return { occasionLabel: null, applicantLabel: en };
    }
    return { occasionLabel: en || null, applicantLabel: null };
}
