export const processAgentRequest = jest.fn().mockResolvedValue({
    success: true,
    result: { action: 'NAVIGATE', url: '/lesson-plan?topic=Photosynthesis' }
});
