"use strict";

// emptyAnchor
const emptyAnchor = () => {
	const tagA = document.querySelectorAll("a");
	tagA.forEach(item => {
		const href = item.getAttribute("href");
		item.addEventListener("click", (el) => {
			if (href === "#") el.preventDefault();
		});
	});
}
emptyAnchor();

// structuredList
const structuredList = () => {
	// 리스트 전체
	const checks = document.querySelectorAll(".krds-structured-list .structured-item");
	checks.forEach((item) => {
		const checkbox = item.querySelector("input[type=checkbox]");
		if (!checkbox) return;
		item.style.cursor = "pointer";
		if (checkbox.checked) item.classList.add("is-check");

		const badge = item.querySelector(".card-top .krds-badge").textContent.trim();
		const cardTitle = item.querySelector(".card-body .c-tit").textContent.trim();
		checkbox.setAttribute("aria-label", `${badge} > ${cardTitle}`);

		checkbox.addEventListener("focus", () => {
			const styles = {
				"outline": "0.2rem solid #fff",
				"outline-offset": "0",
				"box-shadow": "0 0 0 0.4rem #256ef4",
				"transition": "outline 0s, box-shadow 0s !important",
			};
			Object.entries(styles).forEach(([key, value]) => {
				checkbox.nextElementSibling.style.setProperty(key, value);
			});
		});
		checkbox.addEventListener("focusout", () => {
			checkbox.nextElementSibling.style = "";
		});

		checkbox.addEventListener("click", (event) => {
			event.stopPropagation();
			event.target.closest(".structured-item").classList.toggle("is-check");
		});
		item.addEventListener("click", (event) => {
			const triggers = item.querySelectorAll("button, a");
			if (!Array.from(triggers).includes(event.target.closest("a")) && !Array.from(triggers).includes(event.target.closest("button"))) {
				event.preventDefault();
				event.target.closest(".structured-item").classList.toggle("is-check");
				if (item.classList.contains("is-check")) {
					checkbox.checked = true;
				} else {
					checkbox.checked = false;
				}
			}
		});
	});
}
structuredList();

// form-check ico-only focus
const labelFocus = () => {
	const checkBoxs = document.querySelectorAll(".box-sec .krds-table-wrap .krds-form-check.ico-only input[type=checkbox]");
	checkBoxs.forEach((check) => {
		check.addEventListener("focus", () => {
			const styles = {
				"outline": "0.2rem solid #fff",
				"outline-offset": "0",
				"box-shadow": "0 0 0 0.4rem #256ef4",
				"transition": "outline 0s, box-shadow 0s !important",
			};
			Object.entries(styles).forEach(([key, value]) => {
				check.nextElementSibling.style.setProperty(key, value);
			});
		});
		check.addEventListener("focusout", () => {
			check.nextElementSibling.style = "";
		});
	});
}
labelFocus();

function addrSch() {
	const $addr = document.querySelector('#sch-result-addr');
	const $tblNo = document.querySelector('#sch-tbl-no');
	const $tbl = document.querySelector('#sch-result-tbl');
	$addr.style.display = 'block';
	$tblNo.style.display = 'none';
	$tbl.style.display = 'block';
}

const displaySettings = () => {
	const adjustDisplay = document.getElementById("modal_adjust_display");
	if (!adjustDisplay) return;
	const modalBack = adjustDisplay.querySelector(".modal-back");
	modalBack.style.backgroundColor = "transparent";
	const root = document.querySelector("html");
	const scaleOptions = adjustDisplay.querySelectorAll(".scale-options .krds-form-check input[type=radio]");
	const viewModeOptions = adjustDisplay.querySelectorAll(".view-mode-options .krds-form-check input[type=radio]");
	const resetDisplay = document.getElementById("reset_display");
	const defaultScale = adjustDisplay.querySelector("#scale_level_medium");
	const defaultViewMode = adjustDisplay.querySelector("#view_mode_light");
	let selectedScale = 1;
	let selectedViewMode = defaultViewMode.value;
	const rootStyles = getComputedStyle(document.querySelector(":root"));
	const getScaleValue = (scale) => rootStyles.getPropertyValue(`--krds-zoom-${scale}`).trim();
	root.setAttribute("data-krds-mode", selectedViewMode);
	const getLocalItem = () => {
		const savedScale = localStorage.getItem("displayScale");
		const savedMode = localStorage.getItem("displayMode");
		if (savedScale) {
			selectedScale = savedScale;
			krds_adjustContentScale.scaleValue(savedScale);
			scaleOptions.forEach((option) => {
				const checkOption = getScaleValue(option.value);
				if (checkOption === savedScale) option.checked = true;
			});
		}
		if (savedMode) {
			selectedViewMode = savedMode;
			if (savedMode === "theme") root.removeAttribute("data-krds-mode");
			else root.setAttribute("data-krds-mode", savedMode);
			viewModeOptions.forEach((option) => {
				if (option.value === savedMode) option.checked = true;
			});
		}
	};
	getLocalItem();
	const setLocalItem = () => {
		localStorage.setItem("displayScale", selectedScale);
		localStorage.setItem("displayMode", selectedViewMode);
		setscaledLayout();
	};
	const setscaledLayout = () => {
		const zoomLevel = document.body.style.zoom;
		const wrap = document.getElementById("wrap");
		if (window.innerWidth >= 1024 && zoomLevel > 1) wrap.classList.add("krds-scaled-layout");
		else wrap.classList.remove("krds-scaled-layout");
	};
	setscaledLayout();
	window.addEventListener("resize", () => setscaledLayout());
	const applyDisplay = () => {
		krds_adjustContentScale.scaleValue(selectedScale);
		if (selectedViewMode === "theme") root.removeAttribute("data-krds-mode");
		else root.setAttribute("data-krds-mode", selectedViewMode);
		setLocalItem();
	};
	scaleOptions.forEach((option) => {
		option.addEventListener("click", () => {
			selectedScale = getScaleValue(option.value);
			applyDisplay();
		});
	});
	viewModeOptions.forEach((option) => {
		option.addEventListener("click", () => {
			selectedViewMode = option.value;
			applyDisplay();
		});
	});
	resetDisplay.addEventListener("click", () => {
		defaultScale.checked = true;
		defaultViewMode.checked = true;
		selectedScale = 1;
		krds_adjustContentScale.scaleValue(selectedScale);
		selectedViewMode = defaultViewMode.value;
		root.setAttribute("data-krds-mode", selectedViewMode);
		setLocalItem();
	});
};
displaySettings();
