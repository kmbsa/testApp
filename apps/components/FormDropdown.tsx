import React, { useState } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native'; // <-- IMPORT StyleProp and ViewStyle
import { Dropdown } from 'react-native-element-dropdown';

export type DropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type FormDropdownProps = {
  data: DropdownItem[];
  onValueChange?: (value: string) => void;
  value?: string | null;
  placeholder?: string;
  dependentOnValue?: string | null;
  filterData?: (
    data: DropdownItem[],
    dependentValue: string | null,
  ) => DropdownItem[];
  // 1. Added style prop to allow external styling
  style?: StyleProp<ViewStyle>;
  disabled?: boolean; // Adding this for completeness based on MapDetailsUpdate usage
};

const DropdownComponent: React.FC<FormDropdownProps> = ({
  data,
  onValueChange,
  value: controlledValue,
  placeholder = 'Select item',
  dependentOnValue,
  filterData,
  style, // 2. Destructured the style prop
  disabled = false,
}) => {
  const [internalValue, setInternalValue] = useState<string | null>(null);
  const [isFocus, setIsFocus] = useState(false);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const filteredData =
    dependentOnValue !== undefined && filterData
      ? filterData(data, dependentOnValue)
      : data;

  const handleChange = (item: DropdownItem) => {
    if (controlledValue === undefined) {
      setInternalValue(item.value);
    }
    onValueChange?.(item.value);
    setIsFocus(false);
  };

  return (
    // 3. Applied external style to the container View
    <View style={[styles.container, style]}>
      <Dropdown
        style={[
          styles.dropdown,
          isFocus && { borderColor: 'blue' },
          disabled && styles.disabledDropdown,
        ]}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        iconStyle={styles.iconStyle}
        data={filteredData}
        search
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder={!isFocus ? placeholder : '...'}
        searchPlaceholder="Search..."
        value={value}
        onFocus={() => setIsFocus(true)}
        onBlur={() => setIsFocus(false)}
        onChange={handleChange}
        disable={disabled}
      />
    </View>
  );
};

export default DropdownComponent;

const styles = StyleSheet.create({
  container: {
    // This width is what you are now overriding from the parent
    // If you had a fixed width here, the style prop will now override it.
    backgroundColor: '#3D550C',
    padding: 0,
    marginBottom: 15,
  },
  dropdown: {
    height: 50,
    borderColor: 'gray',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: 'white',
  },
  disabledDropdown: {
    backgroundColor: '#f0f0f0',
  },
  icon: {
    marginRight: 5,
  },
  label: {
    position: 'absolute',
    backgroundColor: 'white',
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 20,
  },
  placeholderStyle: {
    fontSize: 16,
    color: 'gray',
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
});
