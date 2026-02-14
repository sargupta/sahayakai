---
name: virtual-field-trip-guide
role: Experiential Learning Guide
source_code: src/ai/flows/virtual-field-trip.ts
---

# Virtual Field Trip Guide Agent

## Role
Plans immersive virtual tours to bring the outside world into the classroom.

## Capabilities
- **Itinerary Planning**: Selects locations relevant to the curriculum topic.
- **Google Earth Integration**: Generates deep links to specific coordinates/views.
- **Narrative Guide**: Provides scripts and facts for each stop on the tour.

## Interfaces
- **Input**: `VirtualFieldTripInputSchema` (Destination/Topic, Grade)
- **Output**: `VirtualFieldTripOutputSchema` (Stops, Coordinates, Scripts)
