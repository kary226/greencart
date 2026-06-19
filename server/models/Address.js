import mongoose from "mongoose";

const AddAddress = () => {
    const { axios, user, navigate, setShowUserLogin, fetchUser } = useAppContext();

    const [address, setAddress] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        street: '',
        cityId: '',
        communeId: '',
        phone: user?.phone || '',
    });

    // ... reste du code identique, plus besoin de getFirstAndLastName()
};

const addressSchema = new mongoose.Schema({
    userId: {type: String, required: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, default: ''},
    street: {type: String, required: true},
    city: {type: String, default: ''},
    state: {type: String, default: ''},
    zipcode: {type: String, default: ''},
    country: {type: String, default: 'Côte d\'Ivoire'},
    phone: {type: String, required: true},
    // Nouveaux champs pour localisation
    cityId: {type: mongoose.Schema.Types.ObjectId, ref: 'city', default: null},
    communeId: {type: mongoose.Schema.Types.ObjectId, ref: 'commune', default: null},
    cityName: {type: String, default: ''},
    communeName: {type: String, default: ''}
}, { timestamps: true });

const Address = mongoose.models.address || mongoose.model('address', addressSchema);
export default Address;