const base_url = document.location.origin + document.location.pathname;
onst API_KEY = "<your google map api key>"; d
const CALLBACK_NAME = "gmapsCallback";

let initialized = !!window.google;
let resolveInitPromise;
let rejectInitPromise;
const initPromise = new Promise((resolve, reject) => {
	resolveInitPromise = resolve;
	rejectInitPromise = reject;
});

var Main = {
	data() {
		return {
			input: "",
			google: null,
			map: null,
			searchBox: null,
			placesService: null,
			searching: { places: false },
			places: false,
			radius: 150,
			place: null,
		};
	},
	watch: {
		input() {
			this.places = this.place = false;
		},
	},
	computed: {},
	created() {},
	async mounted() {
		try {
			this.google = await this.initMap();
			this.initSearchBox();
		} catch (error) {
			console.error(error);
			this.$alert(error, "Error");
		}
	},
	methods: {
		initMap() {
			if (initialized) return initPromise;

			initialized = true;

			window[CALLBACK_NAME] = () => resolveInitPromise(window.google);

			const script = document.createElement("script");
			script.async = true;
			script.defer = true;
			script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=${CALLBACK_NAME}&libraries=places`;
			script.onerror = rejectInitPromise;
			document.querySelector("head").appendChild(script);

			return initPromise;
		},
		initSearchBox() {
			this.searchBox = new google.maps.places.SearchBox(
				document.getElementById("pac-input")
			);
			this.placesService = new google.maps.places.PlacesService(
				document.getElementById("places_div")
			);
			google.maps.event.addListener(
				this.searchBox,
				"places_changed",
				this.placesChangedCallback
			);
		},
		placesChangedCallback() {
			this.searching.places = true;
			var places = this.searchBox.getPlaces();
			console.log(places);
			this.place = places[0];
			this.placesCallback(this.place);
		},
		placesCallback(place) {
			const location = new google.maps.LatLng(
				place.geometry.location.lat(),
				place.geometry.location.lng()
			);
			this.placesService.nearbySearch(
				{ radius: this.radius * 1000, location },
				this.nearbyPlacesCallback
			);
		},
		nearbyPlacesCallback(places) {
			const vm = this;
			this.searching.places = false;
			this.places = [];
			places.forEach((itm) => {
				this.places.push({ ...itm, fetched: false, fetching: false });
			});

			this.fetchPlaceDetails();
		},
		fetchPlaceDetails() {
			const vm = this;
			const places = vm.places;
			const displayFields = {
				name: "Name",
				formatted_address: "Address",
				website: "Website",
			};

			const fields = ["place_id"].concat(Object.keys(displayFields));
			const placeIdx = this.places.findIndex((itm) => !itm.fetched);
			if (placeIdx === -1) {
				return;
			}
      places[placeIdx].fetching = true;
      vm.places = places;
			const request = {
				placeId: places[placeIdx].place_id,
				fields,
			};
			vm.placesService.getDetails(request, function (detailsData) {
				/*
				console.log(
					detailsData
						? {
								name: detailsData.name,
								formatted_address: detailsData.formatted_address,
						  }
						: "No details for " + place.name
				);
        */
				const places = vm.places;
				const placeIdx = vm.places.findIndex((place) => {
					return detailsData && place.place_id === detailsData.place_id;
				});
				if (placeIdx !== -1) {
					const details = {};
					Object.keys(displayFields).forEach((field) => {
						details[displayFields[field]] = detailsData[field];
					});
					places[placeIdx]["details"] = details;
					places[placeIdx].fetched = true;
					places[placeIdx].fetching = false;

					vm.places = places;
				}
				vm.fetchPlaceDetails();
			});
		},
		csvExport() {
			const csvHeaderCols = ["Id", "Name", "Address", "Website"];

			let rows = [];
			let item = [];
			let keyVal = "";
			rows.push("data:text/csv;charset=utf-8,");
			rows.push(csvHeaderCols);
			for (i = 0; i < this.places.length; i++) {
				item = [
					`"${this.places[i].place_id}"`,
					`"${this.places[i].name}"`,
					`"${
						this.places[i].details && this.places[i].details["Address"]
							? this.places[i].details["Address"]
							: ""
					}"`,
					`"${
						this.places[i].details && this.places[i].details["Website"]
							? this.places[i].details["Website"]
							: ""
					}"`,
				];

				rows.push(item);
			}
			let csvContent = rows.join("\n").replace(/(^\[)|(\]$)/gm, "");

			const data = encodeURI(csvContent);
			const link = document.createElement("a");
			const name = new Date()
				.toGMTString()
				.toString()
				.toLowerCase()
				.replace(/:/g, "-")
				.replace(/\s+/g, "-")
				.replace(/[^\w\-]+/g, "")
				.replace(/\-\-+/g, "-")
				.replace(/^-+/, "")
				.replace(/-+$/, "");
			link.setAttribute("href", data);
			link.setAttribute("download", name + "-" + this.place.name + ".csv");
			link.click();
		},
	},
};

const app = Vue.createApp(Main);
app.use(ElementPlus);
app.mount("#app");
