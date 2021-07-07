const base_url = document.location.origin + document.location.pathname;
const API_KEY = "<your google map api key>";
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
			placeItems: false,
			radius: 0.5,
			place: null,
			pages: 0,
		};
	},
	watch: {
		input() {
			this.placeItems = this.place = false;
		},
	},
	computed: {
		fetch_page() {
			return "Getting Page " + this.pages;
		},
		fetched_details() {
			const ret = (this.placeItems || []).filter((itm) => itm.fetched);
			return ret ? ret.length : 0;
		},
		processed_all() {
			const places = this.placeItems || [];
			return this.fetched_details === places.length;
		},
	},
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
			this.pages = 1;
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
			this.placeItems = [];
			this.placesService.nearbySearch(
				{ radius: this.radius * 1000, location },
				this.nearbyPlacesCallback
			);
		},
		nearbyPlacesCallback(places, status, pagination) {
			const vm = this;
			if (places) {
				places.forEach((itm) => {
					const item = {
						place_id: itm.place_id,
						icon: itm.icon,
						name: itm.name,
						details: [],
						fetched: false,
						fetching: false,
					};
					this.placeItems.push(item);
				});
			}

			if (pagination && pagination.hasNextPage) {
				this.pages = this.pages + 1;
				pagination.nextPage();
			} else {
				this.searching.places = false;
				this.fetchPlaceDetails();
			}
		},
		fetchPlaceDetails() {
			const vm = this;
			const places = vm.placeItems;
			const displayFields = {
				name: "Name",
				formatted_address: "Address",
				website: "Website",
			};

			const fields = ["place_id"].concat(Object.keys(displayFields));
			const placeIdx = this.placeItems.findIndex((itm) => !itm.fetched);
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
			for (i = 0; i < this.placeItems.length; i++) {
				item = [
					`"${this.placeItems[i].place_id}"`,
					`"${this.placeItems[i].name}"`,
					`"${
						this.placeItems[i].details && this.placeItems[i].details["Address"]
							? this.placeItems[i].details["Address"]
							: ""
					}"`,
					`"${
						this.placeItems[i].details && this.placeItems[i].details["Website"]
							? this.placeItems[i].details["Website"]
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
