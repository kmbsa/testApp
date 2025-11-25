import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

function UserAgreement() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();

  const localStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Styles.container.backgroundColor,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: Styles.inputFields.borderColor,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1a1a1a',
      marginTop: 15,
      marginBottom: 8,
    },
    sectionText: {
      fontSize: 14,
      color: '#333333',
      lineHeight: 22,
      marginBottom: 12,
    },
    bulletPoint: {
      flexDirection: 'row',
      marginBottom: 10,
      paddingLeft: 10,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      color: '#333333',
      lineHeight: 22,
      marginLeft: 8,
    },
    footerContainer: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderTopWidth: 1,
      borderTopColor: Styles.inputFields.borderColor,
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    acceptButton: {
      backgroundColor: Styles.button.backgroundColor,
    },
    closeButton: {
      backgroundColor: Styles.inputFields.borderColor,
    },
    buttonText: {
      fontWeight: '600',
      fontSize: 14,
      color: Styles.buttonText.color,
    },
    closeButtonText: {
      color: Styles.text.color,
    },
  });

  return (
    <View
      style={[
        localStyles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={localStyles.header}>
        <Text style={localStyles.headerTitle}>User Agreement</Text>
      </View>

      <ScrollView
        style={localStyles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={localStyles.sectionTitle}>
          1. Data Collection and Privacy
        </Text>
        <Text style={localStyles.sectionText}>
          By using this application, you agree to the collection and processing
          of the following data necessary to operate and improve our services:
        </Text>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            <Text style={{ fontWeight: '600' }}>Personal Information:</Text>{' '}
            Name, email address, contact number, sex, and password for account
            creation and identification.
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            <Text style={{ fontWeight: '600' }}>Location Data:</Text> GPS
            coordinates and geographic information for mapping and farm area
            identification purposes.
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            <Text style={{ fontWeight: '600' }}>IP Address:</Text> Your device's
            IP address for security verification, fraud prevention, and service
            analytics.
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            <Text style={{ fontWeight: '600' }}>Device Information:</Text>{' '}
            Device identifier, operating system, app version, and device
            settings for troubleshooting and compatibility optimization.
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            <Text style={{ fontWeight: '600' }}>Activity Logs:</Text> User
            actions within the application for quality assurance, performance
            monitoring, and feature improvements.
          </Text>
        </View>

        <Text style={localStyles.sectionTitle}>2. Use of Collected Data</Text>
        <Text style={localStyles.sectionText}>
          We collect this information to:
        </Text>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Provide, maintain, and improve application functionality
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Authenticate and verify your identity
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Ensure application security and prevent unauthorized access
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Analyze user behavior and optimize application performance
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Provide location-based features and services
          </Text>
        </View>

        <Text style={localStyles.sectionTitle}>3. Data Security</Text>
        <Text style={localStyles.sectionText}>
          We implement reasonable security measures to protect your personal
          information. However, no method of transmission over the internet or
          electronic storage is completely secure.
        </Text>

        <Text style={localStyles.sectionTitle}>4. User Responsibilities</Text>
        <Text style={localStyles.sectionText}>You agree to:</Text>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Provide accurate and complete information during registration
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Maintain the confidentiality of your password
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Not use the application for any unlawful or prohibited purpose
          </Text>
        </View>

        <Text style={localStyles.sectionTitle}>5. Permissions</Text>
        <Text style={localStyles.sectionText}>You authorize us to:</Text>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Access your device's location services for location-based features
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Monitor your IP address for security and service optimization
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Collect device information and identifiers for analytics and
            troubleshooting
          </Text>
        </View>

        <View style={localStyles.bulletPoint}>
          <Text style={localStyles.bulletText}>
            • Log your application activity for quality assurance and
            improvement
          </Text>
        </View>

        <Text style={localStyles.sectionTitle}>6. Limitation of Liability</Text>
        <Text style={localStyles.sectionText}>
          This application is provided on an "as-is" basis. We shall not be
          liable for any damages arising from the use or inability to use the
          application.
        </Text>

        <Text style={localStyles.sectionTitle}>7. Changes to Terms</Text>
        <Text style={localStyles.sectionText}>
          We reserve the right to modify these terms and conditions at any time.
          Continued use of the application constitutes acceptance of any
          changes.
        </Text>

        <Text style={localStyles.sectionTitle}>8. Acknowledgment</Text>
        <Text style={localStyles.sectionText}>
          By checking the "I agree to the User Agreement" box, you acknowledge
          that you have read, understood, and agree to all terms and conditions
          outlined in this document.
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={localStyles.footerContainer}>
        <TouchableOpacity
          style={[localStyles.button, localStyles.closeButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[localStyles.buttonText, localStyles.closeButtonText]}>
            Close
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[localStyles.button, localStyles.acceptButton]}
          onPress={() => {
            // Store flag in parent component's navigation state before going back
            const parentRoute =
              navigation.getState().routes[
                navigation.getState().routes.length - 2
              ];
            if (parentRoute) {
              (global as any).agreedToTermsFlag = true;
            }
            navigation.goBack();
          }}
        >
          <Text style={localStyles.buttonText}>I Agree</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default UserAgreement;
