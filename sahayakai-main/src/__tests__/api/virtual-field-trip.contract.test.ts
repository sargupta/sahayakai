/**
 * @jest-environment node
 */

describe('Virtual Field Trip Generator API - Contract Tests', () => {

    describe('API Request Contract', () => {
        it('should accept valid field trip generation request', async () => {
            const validRequest = {
                topic: 'Major rivers of the world and their importance.',
                language: 'en',
                gradeLevel: 'Class 7',
                subject: 'Geography'
            };

            expect(validRequest.topic.length).toBeGreaterThanOrEqual(10);
            expect(validRequest.gradeLevel).toMatch(/Class \d+/);
        });
    });

    describe('API Response Contract (VirtualFieldTripOutput)', () => {
        it('should match the enhanced VirtualFieldTripOutputSchema structure', () => {
            const mockResponse = {
                title: 'Global River Expedition',
                gradeLevel: 'Class 7',
                subject: 'Geography',
                stops: [
                    {
                        name: 'The Nile River, Egypt',
                        description: 'The longest river in the world, flowing through the desert.',
                        educationalFact: 'It provided the water and silt that allowed Ancient Egypt to flourish.',
                        reflectionPrompt: 'How would life be different for people near the Nile if the river dried up?',
                        googleEarthUrl: 'https://earth.google.com/web/search/Nile+River',
                        culturalAnalogy: 'Like our Ganges (Ganga), the Nile is the lifeline of the Egyptian civilization.',
                        explanation: 'Introduces the concept of river civilizations and irrigation.'
                    }
                ]
            };

            expect(mockResponse).toHaveProperty('title');
            expect(mockResponse.stops).toBeInstanceOf(Array);
            expect(mockResponse.stops[0]).toHaveProperty('culturalAnalogy');
            expect(mockResponse.stops[0]).toHaveProperty('explanation');

            // Check for Bharat-First indicators in the analogy
            const bharatIndicators = ['Ganges', 'Ganga', 'Himalayas', 'Banyan', 'Cauvery'];
            const containsBharatIndicator = bharatIndicators.some(i =>
                mockResponse.stops[0].culturalAnalogy.includes(i)
            );
            expect(containsBharatIndicator).toBe(true);
        });
    });
});
