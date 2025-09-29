import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const responsiveFormPadding = width * 0.06;

const Styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  formBox: {
    backgroundColor: '#3D550C',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    alignSelf: 'center',
  },
  responsiveFormContainer: {
    width: '95%',
    maxWidth: 500,
    paddingHorizontal: responsiveFormPadding,
    paddingVertical: responsiveFormPadding,
    alignSelf: 'center',
  },
  fieldsContainer: {
    alignItems: 'flex-start',
    width: '100%',
    justifyContent: 'center',
  },
  text: {
    color: '#F4D03F',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  inputFields: {
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    marginBottom: 15,
    fontSize: 18,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3D550C',
    width: 300,
  },
  button: {
    backgroundColor: '#F4D03F',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    width: 300,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#3D550C',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
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
  welcomeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#3D550C',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingIndicator: {
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
  background: {
    backgroundColor: '#F5F5DC',
  },
  header: {
    backgroundColor: '#3D550C',
  },
  headerText: {
    color: '#F4D03F',
  },
  itemBackground: {
    backgroundColor: '#F9F9E0',
  },
});

export default Styles;
