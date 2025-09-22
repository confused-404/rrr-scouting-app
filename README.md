# RRR Scouting App

A comprehensive FRC scouting application with The Blue Alliance integration for automated event management and real-time team data.

## Features

- **Match Scouting**: Comprehensive data collection for individual team performance
- **Pit Scouting**: Team capability assessment and strategic information gathering  
- **Super Scouting**: High-level match analysis and strategic notes
- **Team Rankings**: Automated ranking system based on collected data
- **Alliance Picklist**: Strategic team selection for alliance formation
- **Performance Analytics**: Data visualization and trend analysis
- **Match Schedule**: Import and manage competition schedules
- **Team Lookup**: Quick access to team information and statistics
- **Match Strategy**: Pre-match planning and opponent analysis
- **Scouting Teams**: Organize and assign scouting responsibilities
- **The Blue Alliance Integration**: Automatic event import and real team name fetching
- **Team Management**: Bulk team name fetching and caching from TBA
- **Event Import**: One-click import of match schedules from FRC events
- **Mobile Responsive**: Optimized for tablets and mobile devices used at competitions

## The Blue Alliance Integration

This app integrates with The Blue Alliance API to provide:

### Automatic Event Import
- Search for FRC events by name, code, or location
- One-click import of complete match schedules
- Automatic team name fetching for all event participants
- Support for current and upcoming events

### Team Name Management
- Bulk fetch team names from TBA
- Intelligent caching for offline access
- Fallback to manual team names when API is unavailable
- Real-time team name updates during scouting

### Setup Instructions

1. Get a TBA API key from [The Blue Alliance Account Page](https://www.thebluealliance.com/account)
2. Copy `.env.example` to `.env`
3. Add your API key: `VITE_TBA_API_KEY=your_api_key_here`
4. Restart the development server

### Usage

**For Event Import:**
1. Go to Match Schedule (Admin only)
2. Use "Import from The Blue Alliance" section
3. Search for your event by name or code
4. Select the event and click "Import Match Schedule & Team Names"

**For Team Management:**
1. Go to Admin Dashboard → Teams tab
2. Enter team numbers (comma or space separated)
3. Click "Fetch Names" to get real team names from TBA
4. Use "Preload Cache" for faster access during scouting

## Development Status

### high priority
when adding data through admin view, it doesnt save - fixed (or was not able to reproduce anymore)

how to change rating 

non admins shouldnt be able to change match schedule - fixed

fix phone viewing - fixed as far as I could test (especially for normie scouters)

add team names - fixed (in most places)

import match schedule - imported from TBA

make it so that admins can see multiple autos if multiple autos added

match strategy (look at 3 teams data simultaneously) - fixed

team lookup - fixed

also have one big pick list - fixed

make everything in picklist manually editable - somewhat fixed

make buttons on dashboard look better (align them) - fixed

manually create scouting teams and automatically assign them to shiffts of scouting one slot (eg. red 1) - fixed
    - let us enter desired shift length by number of matches

make data analysis better

super scouting notes won't show up for a team if no normal notes are present - fixed

## low priority
data analysis graph generator: 
    -x axis should be time (during a regional or across the season)
    -plot only selected teams (let us enter unlimited team numbers which get plotted against each other) and have an option to plot all teams at the regional
    -y axis should have all the current options from both the x and y axis dropdowns (excluding team number and match number)
