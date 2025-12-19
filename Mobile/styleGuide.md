### A Guide to Theming and Styling Your App

Your app uses a centralized theming system powered by `react-native-paper`. This makes it easy to manage colors and styles consistently.

#### 1. How to Change Existing Colors

This is the simplest way to change the app's look and feel. All your colors are in one place.

**File to Edit:** `Mobile/AIoT-Mobile-App/app/theme/theme.js`

Inside this file, you'll find `lightTheme` and `darkTheme` objects. To change a color, just edit the hex code value for the desired property.

*   `primary`: Main brand color. Used for headers or important buttons.
*   `accent`: Highlight color for interactive elements like icons or the active tab.
*   `background`: The main background color for screens.
*   `surface`: The background color for elements that sit on top of the background, like **Cards**.
*   `text`: The default text color.
*   `success`, `warning`, `critical`: Colors used for status indicators (like online status or alert banners).

**Example: To change the card background in dark mode from slate to a dark purple.**

```javascript
// In Mobile/AIoT-Mobile-App/app/theme/theme.js

export const darkTheme = {
  // ...
  colors: {
    // ...
    background: '#141b1f',
    surface: '#2a2133', // <-- CHANGED FROM '#1e282e'
    text: '#E0E0E0',
    //...
  },
};
```

#### 2. How to Apply Themed Styles to Components

This is the most important concept. You need to use styles differently depending on whether they are static (like margins) or dynamic (based on the theme).

**The Golden Rule:**
*   **Static styles** (e.g., `margin`, `padding`, `fontSize`) go in the `StyleSheet.create({...})` block at the bottom of the file. They are fast because they are only created once.
*   **Dynamic, themed styles** (e.g., `backgroundColor`, `color`) must be applied inline, inside the component's `return` statement.

**Example: Applying styles correctly.**

Let's look at `DeviceDetailScreen.js` which we just fixed.

```javascript
const DeviceDetailScreen = ({ route }) => {
  // 1. Get the current theme object. This has all your colors.
  const theme = useTheme(); 
  
  // ...

  return (
    // 2. The main view's background is themed.
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* 3. The Card's background is also themed. */}
      {/* We combine the 'styles.card' (for margin) with an inline object for the color. */}
      <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          
          {/* 4. The text color is automatically handled by Paper's <Text> component. */}
          <Text style={styles.title}>Status Summary</Text>

        </Card.Content>
      </Card>
      
    </ScrollView>
  );
};

// 5. The StyleSheet only contains static, non-color-dependent values.
const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { margin: 8 }, // Provides the margin
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  // ... other static styles
});
```

#### 3. How to Add a New Custom Color and Style

Let's say you want to create a special "subtle" text color for secondary information.

**Step A: Add the new color to your theme.**

Edit `Mobile/AIoT-Mobile-App/app/theme/theme.js`:

```javascript
// ... in lightTheme.colors
export const lightTheme = {
  //...
  colors: {
    //...
    text: '#263238',
    subtleText: '#546E7A', // <-- NEW CUSTOM COLOR
    ...sharedColors,
  },
};

// ... in darkTheme.colors
export const darkTheme = {
  //...
  colors: {
    //...
    text: '#E0E0E0',
    subtleText: '#90A4AE', // <-- NEW CUSTOM COLOR
    ...sharedColors,
  },
};
```

**Step B: Use the new color in your component.**

Now, in any component file, you can use `theme.colors.subtleText`.

```javascript
// In any component, e.g., DeviceDetailScreen.js

const DeviceDetailScreen = ({ route }) => {
  const theme = useTheme();
  // ...
  return (
    //...
    <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
      <Card.Content>
        <Text style={styles.title}>Status Summary</Text>
        
        {/* Using your new custom color inline */}
        <Text style={{ color: theme.colors.subtleText }}>
          Last updated: 2 mins ago
        </Text>

      </Card.Content>
    </Card>
    //...
  );
};
```
