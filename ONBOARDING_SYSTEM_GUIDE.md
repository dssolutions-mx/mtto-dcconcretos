# Onboarding System Guide

## Overview

The onboarding system provides a smooth introduction to the application for new users through two main components:
1. **Policy Acknowledgment Modal** - Ensures users accept company policies before using the system
2. **Guided Tour** - Interactive walkthrough of key features based on user role

---

## How It Works

### 1. Policy Acknowledgment Flow

**When it triggers:**
- Automatically checks when a user logs in
- Only shows if there are active policies in the database
- Only shows if the user hasn't already acknowledged the policy

**Process:**
1. User logs in → `OnboardingProvider` component checks for unacknowledged policies
2. If policy found → Modal appears (cannot be dismissed without accepting)
3. User reads policy → Checks "I have read and accept" checkbox
4. User clicks "Accept and Continue" → Policy acknowledgment saved to database
5. LocalStorage flag set → `policy_acknowledged: 'true'`
6. Tour starts automatically (if on dashboard)

**Database Tables:**
- `policies` - Stores policy documents
- `policy_acknowledgments` - Tracks which users have accepted which policies

**API Endpoint:**
- `POST /api/compliance/policies/[id]/acknowledge` - Records the acknowledgment

---

### 2. Guided Tour Flow

**When it triggers:**
- Only on `/dashboard` or `/` routes
- Only after policy is acknowledged
- Only if tour hasn't been completed before
- 2-second delay to ensure page is fully loaded

**Process:**
1. User acknowledges policy → LocalStorage set to `policy_acknowledged: 'true'`
2. User navigates to dashboard → `OnboardingProvider` checks conditions
3. Conditions met → Tour starts after 2-second delay
4. Tour highlights elements → Uses `data-tour` attributes to find targets
5. User navigates steps → Can go forward, backward, or skip
6. Tour completes → LocalStorage set to `onboarding_tour_completed: 'true'`

**Tour Steps (Role-Based):**

#### For Operators (OPERADOR, DOSIFICADOR):
1. **Dashboard Overview** - Main dashboard introduction
2. **Checklists** - How to access and complete checklists

#### For Managers (GERENCIA_GENERAL, JEFE_UNIDAD_NEGOCIO, JEFE_PLANTA):
1. **Dashboard Overview** - Main dashboard introduction
2. **Compliance Section** - How to monitor compliance
3. **Reports** - How to access reports

#### For Other Roles:
1. **Dashboard Overview** - Basic introduction only

---

## Technical Implementation

### Components

#### `OnboardingProvider`
- **Location**: `components/onboarding/onboarding-provider.tsx`
- **Purpose**: Manages onboarding state and triggers modals/tours
- **Integration**: Added to root layout (`app/layout.tsx`)

#### `PolicyAcknowledgmentModal`
- **Location**: `components/onboarding/policy-acknowledgment-modal.tsx`
- **Features**:
  - Scrollable policy content
  - Checkbox for acceptance
  - Link to full PDF document
  - Cannot be dismissed without accepting

#### `OnboardingTour`
- **Location**: `components/onboarding/onboarding-tour.tsx`
- **Features**:
  - Highlights target elements
  - Shows tooltips with descriptions
  - Navigation controls (Next/Previous/Skip)
  - Progress indicator
  - Responsive positioning

---

## Data Attributes

Elements that should be highlighted in the tour need `data-tour` attributes:

```tsx
// Dashboard grid
<div data-tour="dashboard">
  {/* Dashboard content */}
</div>

// Checklists card
<Card data-tour="checklists">
  {/* Checklist content */}
</Card>

// Compliance sidebar section
<div data-tour="compliance">
  {/* Compliance navigation */}
</div>

// Reports button
<Button data-tour="reports">
  {/* Reports content */}
</Button>
```

---

## LocalStorage Keys

The system uses two LocalStorage keys:

1. **`policy_acknowledged`**
   - Value: `'true'` or not set
   - Set when: User accepts a policy
   - Used for: Determining if tour should start

2. **`onboarding_tour_completed`**
   - Value: `'true'` or not set
   - Set when: User completes or skips the tour
   - Used for: Preventing tour from showing again

---

## Resetting Onboarding

### For Testing/Development:

**Reset Policy Acknowledgment:**
```javascript
localStorage.removeItem('policy_acknowledged')
```

**Reset Tour:**
```javascript
localStorage.removeItem('onboarding_tour_completed')
```

**Reset Both:**
```javascript
localStorage.removeItem('policy_acknowledged')
localStorage.removeItem('onboarding_tour_completed')
// Then refresh the page
```

### For Production:

Users can't reset onboarding themselves. To reset for a user:
1. Delete their acknowledgment from database:
   ```sql
   DELETE FROM policy_acknowledgments 
   WHERE user_id = '<user_id>';
   ```
2. Clear their LocalStorage (requires browser dev tools or admin action)

---

## Customization

### Adding New Tour Steps

Edit `components/onboarding/onboarding-provider.tsx`:

```tsx
const getTourSteps = () => {
  // Add your custom step
  return [
    ...baseSteps,
    {
      id: 'my-feature',
      target: '[data-tour="my-feature"]',
      title: 'My Feature',
      description: 'This is how you use my feature.',
      position: 'bottom' as const
    }
  ]
}
```

Then add the `data-tour` attribute to your element:
```tsx
<div data-tour="my-feature">
  {/* Your feature */}
</div>
```

### Changing Tour Timing

Edit delays in `onboarding-provider.tsx`:
- Policy modal delay: Currently immediate
- Tour start delay: Currently 2000ms (2 seconds)
- Post-acknowledgment delay: Currently 1000ms (1 second)

---

## Troubleshooting

### Tour Not Showing

1. **Check LocalStorage:**
   ```javascript
   console.log(localStorage.getItem('policy_acknowledged'))
   console.log(localStorage.getItem('onboarding_tour_completed'))
   ```

2. **Check User Role:**
   - Tour only shows for certain roles
   - Check `profile.role` in `OnboardingProvider`

3. **Check Route:**
   - Tour only shows on `/dashboard` or `/`
   - Check `pathname` in `OnboardingProvider`

4. **Check Policy:**
   - Must have active policy in database
   - User must not have acknowledged it

### Policy Modal Not Showing

1. **Check Database:**
   ```sql
   SELECT * FROM policies WHERE is_active = true;
   ```

2. **Check Acknowledgment:**
   ```sql
   SELECT * FROM policy_acknowledgments 
   WHERE user_id = '<user_id>';
   ```

3. **Check User Authentication:**
   - User must be logged in
   - Check `isInitialized` and `profile` in `OnboardingProvider`

---

## Best Practices

1. **Keep Tour Steps Short**: 2-4 steps maximum
2. **Use Clear Targets**: Ensure `data-tour` attributes are on visible elements
3. **Test Responsive**: Tour should work on mobile and desktop
4. **Update When Features Change**: Keep tour steps current with UI changes
5. **Don't Overwhelm**: Focus on most important features only

---

## Future Enhancements

Potential improvements:
- [ ] Multi-language support for tour text
- [ ] Analytics tracking for tour completion rates
- [ ] Ability to restart tour from settings
- [ ] Video tutorials integration
- [ ] Interactive tutorials (not just highlights)
- [ ] Contextual help tooltips throughout the app
