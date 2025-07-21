import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;
// responsiveInputWidth is less relevant now that inputFields use width: '100%'
const responsiveFormPadding = width * 0.06; // Keep the value

const Styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC', // Your main app background color
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10, // Padding on the main container
  },
  formBox: {
    backgroundColor: '#3D550C', // Darker background for the form box (decorative)
    borderRadius: 20,
    // padding: responsiveFormPadding, // REMOVED - Sizing/padding in responsiveFormContainer
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    // width: '95%', // REMOVED - Sizing/padding in responsiveFormContainer
    // maxWidth: 500, // REMOVED - Sizing/padding in responsiveFormContainer
    alignSelf: 'center', // Keep centering
  },

  // NEW STYLE: For responsive form containers with max width and padding
  responsiveFormContainer: {
    width: '95%', // Take up 95% of parent width
    maxWidth: 500, // But no more than 500 units (adjust this value as needed)
    paddingHorizontal: responsiveFormPadding, // Apply responsive padding
    paddingVertical: responsiveFormPadding, // Apply responsive padding
    alignSelf: 'center', // Center the container
  },

  fieldsContainer: {
    alignItems: 'flex-start',
    width: '100%', // Keep 100% relative to formBox content area (which now uses responsiveFormContainer)
    justifyContent: 'center',
  },
  text: {
    color: "#F4D03F", // Text color inside the form box
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  inputFields: {
    backgroundColor: '#FFFFFF', // White background for input fields
    marginTop: 10,
    marginBottom: 15,
    fontSize: 18,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3D550C', // Border color matching form box background
    width: 300, // Keep 100% relative to fieldsContainer
  },
  button: {
    backgroundColor: '#F4D03F', // Button background color
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    width: 300,
    alignItems: 'center', // Centers the text/indicator inside the button
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#3D550C', // Text color on buttons
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: { // This style doesn't seem used
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 18,
    color: '#F4D03F',
    textAlign: 'center',
  },
  register: {
    color: '#F4D03F',
    fontSize: 18,
    paddingLeft: 5,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  welcomeText: { // This style doesn't seem used
    fontSize: 26,
    fontWeight: 'bold',
    color: '#3D550C',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingIndicator: { // This style doesn't seem used (inline styling used)
    marginTop: 30,
    alignItems: 'center',
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  radioButtonOuterCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F4D03F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInnerCircle: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#F4D03F',
  },
  radioButtonLabel: {
    marginLeft: 8,
    fontSize: 18,
    color: '#F4D03F',
  },
});

export default Styles;