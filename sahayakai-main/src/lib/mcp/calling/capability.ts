import 'server-only';
import type { McpCapabilityDefinition } from '../http-handler';
import { InitiateParentCallInput, ListParentContactsInput, ParentCallResult, ParentContactsResult } from './schema';
import { initiateParentCall, listParentContacts, renderContactsText, renderParentCallText, type CallingServiceDeps } from './service';

/**
 * Sahayak Parent Calling — public MCP capability (scope `calling`).
 * Tools: `list_parent_contacts` (read-only, masked) and `initiate_parent_call`
 * (places a REAL phone call through the app's existing Contact flow).
 */
export const CALLING_VERSION = '1.0.0';

export const INITIATE_PARENT_CALL_DESCRIPTION =
    'Places a real phone call from Sahayak to a student\'s parent, exactly like the "Contact" button in the Sahayak ' +
    'attendance app: Sahayak writes a short message for the given reason (absences, academic concern, behaviour, or ' +
    'good news) in the parent\'s language and its voice assistant calls the parent number stored on the student ' +
    'record. You cannot supply a phone number. Allowed only 09:00–21:00 IST and at most once per student every 5 ' +
    'minutes. Get class_id and student_id from list_parent_contacts. Takes about 10–30 seconds.';

export function callingCapability(deps: CallingServiceDeps): McpCapabilityDefinition {
    return {
        scope: 'calling',
        serverInfo: { name: 'sahayak-parent-calling', title: 'Sahayak Parent Calling', version: CALLING_VERSION },
        instructions:
            'Sahayak Parent Calling lets a school\'s system reach parents by phone through Sahayak. Use list_parent_contacts ' +
            'to find a class and student, then initiate_parent_call. Calls go only to parent numbers stored in Sahayak.',
        register(server, ctx) {
            server.registerTool(
                'list_parent_contacts',
                {
                    title: 'List parent contacts',
                    description: 'Lists the school\'s classes and students that parents can be called for, with whether a parent phone is on record and its last 4 digits. Never returns full phone numbers. Read-only.',
                    inputSchema: ListParentContactsInput,
                    outputSchema: ParentContactsResult,
                    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
                },
                async (args) => ctx.run(
                    'list_parent_contacts',
                    ({ principal }) => listParentContacts(args as ListParentContactsInput, principal, deps),
                    renderContactsText,
                ),
            );
            server.registerTool(
                'initiate_parent_call',
                {
                    title: 'Call a parent',
                    description: INITIATE_PARENT_CALL_DESCRIPTION,
                    inputSchema: InitiateParentCallInput,
                    outputSchema: ParentCallResult,
                    // A real-world side effect: rings a phone and records an outreach for the teacher.
                    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
                },
                async (args) => ctx.run(
                    'initiate_parent_call',
                    ({ principal }) => initiateParentCall(args as InitiateParentCallInput, principal, deps),
                    renderParentCallText,
                ),
            );
        },
    };
}
